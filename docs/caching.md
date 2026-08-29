# Caching — System Design Reference Guide

> Source: [Hello Interview — Core Concepts: Caching](https://www.hellointerview.com/learn/system-design/core-concepts/caching)

---

## Table of Contents

1. [Why Caching?](#1-why-caching)
2. [Where to Cache](#2-where-to-cache) — External (Redis vs Memcached), CDN, Client-Side, In-Process
3. [Cache Architectures](#3-cache-architectures) — Cache-Aside, Write-Through, Write-Behind, Read-Through, Write-Around
4. [Cache Eviction Policies](#4-cache-eviction-policies) — LRU, LFU, FIFO, TTL
5. [Common Caching Problems](#5-common-caching-problems) — Stampede, Consistency, Penetration, Avalanche, Hot Keys
6. [Caching in System Design Interviews](#6-caching-in-system-design-interviews) — Framework, Sizing, Decision Tree

---

## 1. Why Caching?

Databases store data on **disk**. Reading from disk is slow. Memory is orders of magnitude faster.

| Storage Layer | Typical Read Latency |
|---|---|
| Disk (database) | 50ms |
| In-memory cache (Redis) | 1ms |
| In-process memory | ~0.1ms |

**The core trade-off:** Caching improves read performance but introduces complexity — you now have two sources of truth that can go out of sync.

Caching makes sense when:
- Reads are far more frequent than writes
- The data is expensive to compute or fetch (joins, aggregations)
- Temporary staleness is acceptable

---

## 2. Where to Cache

There are four places data can be cached. Each has a different scope, latency, and trade-off.

```
User Device          CDN Edge          App Server          Database
    │                   │                   │                  │
    │  (client-side)    │  (CDN cache)      │  (in-process)    │
    │                   │                   │                  │
    │                               [External Cache]           │
    │                               Redis / Memcached          │
    │                                   │                      │
    └────────────── request ────────────►│◄─── read/write ────►│
```

---

### 2.1 External Cache (Redis / Memcached)

A dedicated caching server that sits between your application and the database.

```
App Server 1 ──┐
App Server 2 ──┤──► [ Redis ] ──► Database
App Server 3 ──┘
```

- Every app server shares the same cache — no duplication
- Supports LRU eviction and TTL expiration natively
- **Default choice for interviews.** When in doubt, use Redis.

**Redis vs Memcached — Why Redis Wins Almost Every Time**

| | Redis | Memcached |
|---|---|---|
| **Data structures** | Strings, Lists, Sets, Sorted Sets, Hashes, Streams | Strings only |
| **Persistence** | RDB snapshots + AOF logs | In-memory only — data lost on restart |
| **Replication** | Native master-replica | No native replication |
| **Clustering** | Redis Cluster (built-in) | Client-side sharding only |
| **Atomic operations** | INCR, LPUSH, ZADD, etc. | Very limited |
| **Use Memcached when** | — | Simple string caching + need raw multi-threaded throughput |
| **Use Redis when** | Almost always | — |

> **Interview answer:** "I'd default to Redis — it supports richer data structures like sorted sets for leaderboards, has built-in persistence, replication, and clustering. Memcached is simpler and slightly faster for pure string caching but lacks almost everything else."

---

### 2.2 CDN (Content Delivery Network)

CDNs cache content on geographically distributed **edge servers**, serving users from the nearest node.

```
Origin Server (Virginia)
        │
        ├──► CDN Edge (London)  ──► European users  (~20ms)
        ├──► CDN Edge (Tokyo)   ──► Asian users     (~20ms)
        └──► CDN Edge (Sydney)  ──► AU users        (~20ms)

Without CDN: Virginia → India = 250–300ms
With CDN:    Edge     → India = 20–40ms
```

**How a CDN cache miss works:**
1. User in Tokyo requests an image
2. Request hits the nearest CDN edge node
3. Edge node has no cached copy (cache miss)
4. Edge node fetches from origin server, caches it
5. Next Tokyo user gets it from the edge in ~20ms

**When to use in interviews:** Introduce CDNs specifically when the design involves static media (images, videos, JS/CSS) at scale. Modern CDNs (Cloudflare, Fastly, Akamai) also support API response caching and edge logic.

---

### 2.3 Client-Side Cache

Data cached directly on the user's device — browser HTTP cache, localStorage, or within mobile apps.

**Examples:**
- Browser caches API responses using `Cache-Control` headers
- Mobile app caches user profile locally to avoid re-fetching on every launch
- Redis client libraries cache cluster topology (which node owns which slot) locally

**Trade-off:** You have limited control over invalidation. Once a client has cached data, you can't easily tell it to refresh.

---

### 2.4 In-Process Cache

Data cached in the application server's own memory — no network hop needed.

```
App Server
┌────────────────────────────────────────┐
│  Request Handler                       │
│       │                                │
│       ▼                                │
│  In-Process Cache (HashMap / Guava)    │
│       │ miss                           │
│       ▼                                │
│  Redis  ──► (miss) ──► Database        │
└────────────────────────────────────────┘
```

**Best for:** Feature flags, config values, reference data, hot keys, rate limiting counters.

**Trade-off:** Each server has its own cache. Server A and Server B can return different values for the same key. Use this as an optimization *on top of* an external cache, not instead of one.

---

## 3. Cache Architectures

How and when data gets written to and read from the cache.

---

### 3.1 Cache-Aside (Lazy Loading)

> **If you only remember one caching pattern for interviews, make it cache-aside.**

The application manages the cache explicitly. The cache is only populated on a cache miss.

```
Application
    │
    │── 1. Check cache for key ──────────────────► Cache
    │                                               │
    │          cache HIT ◄──────── return value ───┘
    │          │
    │          cache MISS
    │          │
    │── 2. Fetch from database ──────────────────► Database
    │          │
    │── 3. Write result to cache ────────────────► Cache
    │          │
    │── 4. Return result to caller
```

**Pros:**
- Simple to implement — works with any database and any cache
- Cache stays lean — only stores what's actually been requested
- Cache failures are non-fatal — app falls back to database

**Cons:**
- Cache misses add latency (3 steps instead of 1)
- First request for any key always hits the database (cold start)
- Risk of stale data if database is updated without invalidating the cache

**Use for:** Most read-heavy workloads. Default pattern.

**Real example:** Instagram profile page — load from Redis on every request, fall back to PostgreSQL on a miss, populate cache for next time.

---

### 3.2 Write-Through

Every write goes to the cache first. The cache synchronously writes to the database before acknowledging success.

```
Application
    │
    │── write(key, value) ──────────────────────► Cache
    │                                               │
    │                             1. write to DB ──►│──► Database
    │                             2. DB confirms ◄──│
    │                                               │
    │◄────────────── write confirmed ───────────────┘
```

**Pros:**
- Cache is always consistent with the database
- Reads always return fresh data

**Cons:**
- **Slower writes** — must wait for both cache and DB to confirm
- **Cache pollution** — writes data that may never be read
- **Dual-write risk** — if the DB write succeeds but cache write fails (or vice versa), they're out of sync
- Requires specialized cache implementations; Redis doesn't support this natively

**Use for:** Workloads where reads must always return fresh data and slightly slower writes are acceptable.

**Real example:** Banking account balance — every debit/credit must be reflected immediately; a stale balance shown to a customer is unacceptable.

---

### 3.3 Write-Behind (Write-Back)

The application writes only to the cache. The cache asynchronously batches and flushes writes to the database in the background.

```
Application
    │
    │── write(key, value) ──────────────────────► Cache
    │◄── immediately confirmed ──────────────────┘
    │                                    │
    │                          (background, async)
    │                                    │
    │                         batch flush to Database
```

**Pros:**
- **Very fast writes** — no waiting for database
- Database receives fewer, batched writes (efficient)

**Cons:**
- **Data loss risk** — if the cache crashes before flushing, unwritten data is lost forever
- Complex to implement correctly

**Use for:** Workloads where occasional data loss is acceptable — analytics pipelines, metrics aggregation, clickstream counters.

**Real example:** YouTube view counter — buffer millions of increments in Redis, flush to the database in batches every few seconds. Losing a few counts if Redis restarts is acceptable.

---

### 3.4 Read-Through

The cache acts as a smart proxy. The application never talks to the database directly. On a cache miss, the **cache itself** fetches from the database.

```
Application
    │
    │── read(key) ──────────────────────────────► Cache
    │                                               │
    │                           cache HIT ──────────┤
    │                                               │ miss
    │                                    fetch from Database
    │                                               │
    │                           cache populated ────┤
    │                                               │
    │◄──────────────── return value ────────────────┘
```

**Difference from cache-aside:** In cache-aside, the *application* fetches from DB on a miss. In read-through, the *cache* does it.

**Pros:**
- Application code is simpler — always reads from cache, never database
- CDNs are a real-world example of read-through caching

**Cons:**
- Requires specialized library support
- Less common and less flexible than cache-aside

**Use for:** CDN-style setups, or frameworks that abstract the cache-DB relationship.

**Real example:** Cloudflare CDN — serves cached HTML/assets on every request; on a cache miss, fetches from the origin server, caches the response, and serves future requests from the edge.

---

### 3.5 Write-Around

Writes go **directly to the database**, completely bypassing the cache. The cache is only populated when data is subsequently read (via cache-aside or read-through).

```
Application
    │
    │── write(key, value) ──────────────────────► Database only
    │                                              (cache NOT touched)
    │
    │── read(key) ──────────────────────────────► Cache MISS
    │                                               │
    │                                    fetch from Database
    │                                               │
    │                               populate cache ─┤
    │◄──────────── return value ────────────────────┘
```

**Pros:**
- Cache never fills up with write-heavy data that's rarely read
- Avoids cache pollution from one-time writes

**Cons:**
- First read after a write always misses — slightly higher read latency until cache warms

**Use for:** Data that is written frequently but read infrequently, or written once and never queried again — audit logs, event archives, one-time report generation.

**Real example:** Application logs written to S3 constantly. They're almost never read in real time — writing them through the cache would waste cache space entirely.

---

### Pattern Summary

| Pattern | Who populates cache? | Write speed | Read speed | Staleness risk | Best for |
|---|---|---|---|---|---|
| **Cache-Aside** | Application (on miss) | Fast | Fast after warmup | Yes | General read-heavy workloads |
| **Write-Through** | Cache (on every write) | Slow | Always fresh | No | Must-be-fresh data (balances) |
| **Write-Behind** | Cache (async) | Very fast | Fast | Yes (data loss) | High-write, loss-tolerant (counters) |
| **Read-Through** | Cache (on miss) | — | Fast after warmup | Yes | CDN-style, framework-managed |
| **Write-Around** | Not populated on write | Fast | Slower first read | Low | Write-heavy, rarely-read data |

---

## 4. Cache Eviction Policies

When the cache is full, it must decide what to remove to make room for new data.

---

### 4.1 LRU — Least Recently Used

Evicts the item that has not been accessed for the longest time.

```
Access order:  A → B → C → B → A
Cache full, need to evict:
  LRU evicts: C  (longest since last access)
```

**Why it works:** Recently accessed data is likely to be accessed again soon (temporal locality). Adapts well to most real workloads. **Default choice.**

**Real example:** Redis default eviction — when memory is full, the least recently accessed user session is evicted first.

---

### 4.2 LFU — Least Frequently Used

Evicts the item with the lowest total access count.

```
Access counts:  A=15, B=2, C=8
Cache full, need to evict:
  LFU evicts: B  (lowest access count)
```

**Why it works:** Keeps consistently popular items (trending videos, hot products) even if they weren't accessed *recently*.

**Trade-off:** New items start with count=1 and are vulnerable to early eviction even if they're about to become popular.

**Real example:** Spotify song cache — globally popular songs (Blinding Lights, Shape of You) stay cached even if *you* haven't played them recently, because millions of others have.

---

### 4.3 FIFO — First In, First Out

Evicts the oldest item by insertion time, regardless of how often it's been accessed.

```
Insert order:  A (t=1) → B (t=2) → C (t=3)
Cache full, need to evict:
  FIFO evicts: A  (inserted first)
```

**Problem:** A might be the most-accessed item in the cache — FIFO doesn't know or care. **Rarely used in production.**

---

### 4.4 TTL — Time To Live

Not a standalone eviction policy — a complementary mechanism. Each key is given an expiry time. After that time, the key is automatically deleted regardless of access pattern.

```
SET user:123 <value> EX 600   ← expires in 600 seconds
```

**Combines with LRU/LFU:** TTL enforces freshness; LRU/LFU handles capacity.

**Use for:** Session tokens, API responses, any data that must eventually refresh.

**Real example:** JWT session tokens set with `EX 900` (15 minutes) — auto-expire without any application-level cleanup job needed.

---

## 5. Common Caching Problems

---

### 5.1 Cache Stampede (Thundering Herd)

A popular cache entry expires. At that exact moment, hundreds or thousands of simultaneous requests all miss the cache and all hit the database at once.

```
t=0s: cache entry expires
t=0s: 5,000 requests all miss cache simultaneously
t=0s: 5,000 database queries fire in parallel
       ▲
       └── database overwhelmed, latency spikes, possible outage
```

**Real example:** A homepage feed cached with a 60-second TTL. At the moment it expires, every active user's request hits the database to rebuild the feed at the same time.

**Solutions:**

**1. Request Coalescing (Single Flight) — most effective**
Only one request is allowed to rebuild the cache. All others wait and receive the same result once it's ready.
```
Request 1 → cache miss → acquires lock → queries DB → populates cache
Request 2 → cache miss → waits for lock
Request 3 → cache miss → waits for lock
        └── all get result from Request 1's DB query
```

**2. Cache Warming (Proactive Refresh)**
A background job refreshes popular keys *before* they expire. The key is always warm; users never see a miss.
```
Key expires at t=60s
Background job refreshes at t=55s → key never actually expires from users' perspective
```
Only works with TTL-based expiration — not applicable to write-triggered invalidation.

---

### 5.2 Cache Consistency (Stale Data)

The cache and the database have different values for the same key. This happens because writes go to the database while reads come from the cache.

```
t=0:  cache has user.avatar = "old.jpg"
t=1:  user updates avatar → DB now has "new.jpg"
t=2:  reader hits cache → gets "old.jpg" ← stale!
t=3:  TTL expires → cache misses → DB returns "new.jpg" ← fresh
```

**Solutions:**

| Approach | How | When to use |
|---|---|---|
| **Invalidate on write** | Delete the cache key after the DB write. Next read repopulates it. | When freshness matters (e.g., account balance) |
| **Short TTL** | Set a small expiry (e.g., 30s). Accept a brief stale window. | When slight staleness is fine (e.g., view counts) |
| **Eventual consistency** | Don't invalidate at all. Let TTL handle it. | Feeds, metrics, analytics |

**The dual-write problem:** If you write to DB and then delete the cache, what if the cache delete fails? You now have stale cache indefinitely. Common mitigation: retry the cache delete, or use a message queue to decouple the invalidation.

---

### 5.3 Cache Penetration

Requests for keys that **don't exist** in either the cache or the database. Because there's nothing to cache, every such request bypasses the cache entirely and hits the database directly.

```
Attacker or bad client sends:
GET user:99999999   ← doesn't exist in cache OR DB
GET user:88888888   ← doesn't exist in cache OR DB
GET user:77777777   ← doesn't exist in cache OR DB

Every request bypasses cache → hits DB → DB overwhelmed
```

**Real example:** An e-commerce site where someone queries random product IDs that don't exist. Since there's nothing to cache, each request goes straight to the database.

**Solutions:**

**1. Cache Null Values**
When the DB returns nothing, cache the null result with a short TTL. Future requests for the same key get an instant null from cache.
```
DB returns null → SET user:99999999 "null" EX 30
Next request   → cache HIT → returns null immediately → DB protected
```

**2. Bloom Filter (Better for large scale)**
A probabilistic data structure placed in front of the cache. It answers "does this key definitely NOT exist?" with certainty — no DB call needed.
```
Request → Bloom Filter check
             │
             ├── "Definitely NOT in DB" → return 404 immediately (no cache/DB hit)
             └── "Might be in DB"       → check cache → check DB (normal flow)
```
A Bloom filter may have false positives (says "might exist" when it doesn't) but never false negatives — so it will never block a valid key. Used by Redis, Cassandra, and HBase internally.

---

### 5.4 Cache Avalanche

**Different from Stampede.** Stampede is one popular key expiring. Avalanche is when **many different keys** all expire at the same time, causing a flood of DB requests for thousands of distinct keys simultaneously.

```
STAMPEDE:   1 popular key expires    → 1,000 requests hit DB for the same key
AVALANCHE:  10,000 keys expire at    → DB flooded with requests for 10,000
            midnight simultaneously    different keys at once
```

**Real example:** A system pre-warms the entire cache at startup with a fixed TTL of 1 hour for every key. One hour later, all keys expire at exactly the same time — the DB sees a traffic spike equal to a cold start.

**Solution — TTL Jitter (add randomness to expiry):**
```
Instead of:  TTL = 3600s for all keys  → all expire together

Use:         TTL = 3600 + random(0, 300)
             → keys expire spread across a 5-minute window
             → DB load is smoothed out, no spike
```

**Other mitigations:**
- Circuit breaker on the DB — reject excess requests rather than letting the DB fall over
- Pre-warm cache gradually (stagger key population, not all at once)

---

### 5.5 Hot Keys

A single cache key receives a disproportionate amount of traffic — so much that it overloads the single Redis node that owns that key, even if the overall cache hit rate is high.

```
Normal traffic:   100 req/sec evenly spread across 1000 keys
Hot key traffic:  user:taylorswift → 2,000,000 req/sec on ONE node
                  ▲
                  └── that Redis node is a bottleneck
```

**Solutions:**

**1. Replicate the hot key across multiple nodes**
Store `user:taylorswift:replica_0`, `user:taylorswift:replica_1`, ..., `user:taylorswift:replica_N`. Route reads round-robin across replicas.

**2. Local in-process fallback**
Cache the hot value in each app server's own memory. Serves from RAM with zero network cost.

**3. Rate limiting**
Slow down abusive traffic patterns hitting specific keys before they reach the cache.

---

## 6. Caching in System Design Interviews

### When to Bring Up Caching

Don't introduce caching randomly. **Establish the problem first**, then propose caching as the solution.

| Signal | What to say |
|---|---|
| **Read-heavy workload** | "10M DAU making 20 reads/day = 200M reads. At 20–50ms per DB query, that's significant load. Cache drops this to under 2ms." |
| **Expensive queries** | "The personalized feed requires joining posts, followers, and likes — takes 200ms. Caching the computed feed for 60 seconds serves it in 1ms." |
| **High DB CPU** | "Database CPU is hitting 80% during peak from repeated reads on the same data. Caching hot queries cuts DB load by 70–80%." |
| **Latency requirement** | "We need sub-10ms API response times. DB queries take 30–50ms. Caching is necessary to hit that target." |

---

### How to Walk Through Caching in an Interview

**Step 1 — Identify the bottleneck**
Point to a specific component that's slow. Quantify it with numbers. Don't say "the DB is slow" — say "profile reads take 40ms and happen 500 times/second."

**Step 2 — Decide what to cache**
Focus on data that is:
- Frequently read
- Infrequently changed
- Expensive to recompute

Design explicit cache keys: `user:{id}:profile`, `feed:{user_id}:page:1`.

**Step 3 — Choose a cache architecture**
Match the pattern to your consistency requirements:
- Default → **Cache-Aside**
- Always-fresh reads required → **Write-Through**
- Blazing-fast writes, loss acceptable → **Write-Behind**

**Step 4 — Set eviction policy**
- Default: **LRU**
- Popular but infrequently updated items: **LFU**
- Always add a **TTL** to prevent indefinitely stale data

Example: *"LRU eviction with a 10-minute TTL on user profiles."*

**Step 5 — Address the downsides**

Pick one or two relevant problems for your design — don't list all of them:

| Problem | How you'd handle it |
|---|---|
| **Stale data** | Invalidate on write (delete cache key after DB update) |
| **Cache failure** | Fall back to database; use circuit breaker to avoid cascading failures |
| **Thundering herd** | Request coalescing (single flight) for popular keys |
| **Hot keys** | Replicate across nodes or use in-process fallback for extreme cases |
| **Cache penetration** | Cache null values, or use a Bloom filter to reject non-existent keys |
| **Cache avalanche** | Add TTL jitter so keys don't all expire simultaneously |

---

### Cache Sizing — How to Estimate in Interviews

Interviewers often probe cache sizing. Use the **Pareto principle**: cache the top 20% of data that serves 80% of reads.

**Memory estimation example:**
```
System: Twitter-like feed

User profile size  = 1 KB
Total users        = 500M
DAU                = 100M (20%)
Cache top 20% DAU  = 20M profiles

Memory needed = 20M × 1KB = 20GB  → 2–3 Redis nodes (10GB each)
```

**What to cache vs. skip:**
```
CACHE:                              SKIP:
──────────────────────────          ──────────────────────────────
Active user profiles                Long-tail users (rarely accessed)
Hot influencer feeds                Historical data older than 30 days
Popular product listings            One-time generated reports
Session tokens                      Large binary blobs (use CDN instead)
Frequently queried aggregations
```

**Rule of thumb for interviews:** Cache what's read most, changes least, and fits cheaply in memory. If a dataset is >100GB, cache a hot subset — not everything.

---

### Quick Reference: Cache Pattern Decision Tree

```
What is your workload?
        │
        ├── Read-heavy, occasional writes, some staleness OK?
        │         └──► Cache-Aside + LRU + TTL  (default)
        │
        ├── Must always serve fresh data on reads?
        │         └──► Write-Through
        │
        ├── Write-heavy, occasional data loss acceptable?
        │         └──► Write-Behind
        │
        ├── Data written constantly but rarely read?
        │         └──► Write-Around
        │
        └── Serving static or semi-static content globally?
                  └──► CDN

Where should the cache live?
        │
        ├── Shared across multiple app servers?
        │         └──► External Cache (Redis)
        │
        ├── Global, geographically distributed content?
        │         └──► CDN
        │
        └── Single server, hot keys or config?
                  └──► In-Process Cache (on top of Redis)
```

---

### Real-World Pattern Examples — Quick Reference

| Pattern / Policy | Real-World Example |
|---|---|
| **Cache-Aside** | Instagram profile page — Redis first, PostgreSQL fallback |
| **Write-Through** | Bank account balance — always fresh, slower write acceptable |
| **Write-Behind** | YouTube view counter — buffer increments in Redis, flush to DB in batches |
| **Read-Through** | Cloudflare CDN — serves from edge cache, fetches from origin on miss |
| **Write-Around** | Application audit logs — written to S3 constantly, rarely queried |
| **LRU** | Redis session store — oldest unused session evicted when memory is full |
| **LFU** | Spotify song cache — globally popular songs stay cached regardless of recency |
| **TTL** | JWT tokens — `SET token EX 900` auto-expires sessions after 15 minutes |

---

### One-Line Summaries

> **Cache-Aside** — app checks cache first; on miss, fetches DB and populates cache
> **Write-Through** — every write goes to cache + DB synchronously; always fresh, slower writes
> **Write-Behind** — writes hit cache only; DB updated async; fast writes, risk of data loss
> **Read-Through** — cache fetches from DB on miss; app never talks to DB directly
> **Write-Around** — writes skip cache entirely; cache populated only on subsequent reads
> **LRU** — evict what hasn't been used recently; best general-purpose policy
> **TTL** — expire keys after N seconds; prevents indefinitely stale data
> **Thundering Herd** — single-flight coalescing or cache warming prevents mass DB stampede
> **Cache Penetration** — cache null results or use Bloom filter to block non-existent key lookups
> **Cache Avalanche** — TTL jitter spreads expiry across a window; eliminates synchronized spikes
> **Hot Keys** — replicate across nodes or serve from in-process memory

---

*Last updated: May 2026*
*Source: hellointerview.com/learn/system-design/core-concepts/caching*
