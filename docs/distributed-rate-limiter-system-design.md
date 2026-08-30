# Distributed Rate Limiter System Design Summary

> Source: Hello Interview — "Design a Distributed Rate Limiter"

---

## 1. Requirements Gathering

### Functional Requirements
- **Identify clients** — by user ID, IP address, or API key
- **Limit requests** — based on configurable rules (e.g. 100 requests/minute/user)
- **Reject over-limit requests** — with HTTP 429 and headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)

### Non-Functional Requirements
- **Low latency** — under 10ms overhead per request check
- **High availability** — eventual consistency in limit enforcement across nodes is acceptable
- **Scale** — 1M requests/second across 100M daily active users
- **Fail-closed** — a rate-limiter outage should reject traffic rather than let it flood downstream services during exactly the spike the limiter exists to protect against

---

## 2. High-Level Architecture

```
Client → API Gateway (rate limiter: identify client, Token Bucket check)
              │
              ├── pass ──→ Backend Microservices
              │
              └── fail ──→ HTTP 429 + rate-limit headers

API Gateway ⇄ Redis Cluster (sharded via consistent hashing, each shard replicated)
```

### Key Components
| Component | Responsibility |
|-----------|-----------------|
| **API Gateway** | Runs at the edge; identifies the client, runs the rate-limit check, forwards or rejects |
| **Redis Cluster** | Holds each client's token bucket state (`tokens`, `last_refill`); sharded and replicated |

---

## 3. Where to Place the Rate Limiter

| Option | Trade-off |
|---|---|
| **In-process** (each server checks its own local counters) | Fastest, no network call — but each server only sees its own slice of traffic; a global 100 req/min limit becomes an approximate, unpredictable limit split across however many servers exist |
| **Dedicated service** | Centralized, precise global state, rich business context — but adds a network round trip to every request and a new point of failure |
| **API Gateway / Load Balancer** (chosen) | Runs at the very edge before any application server sees the request — bad traffic never reaches the backend at all, conceptually simple, most common in production |

---

## 4. The Token Bucket Algorithm

Each client gets a bucket holding up to N tokens (the burst capacity). Tokens refill at a steady rate; each request consumes one token; an empty bucket means reject. This handles both sustained load (the refill rate) and short bursts (the bucket capacity) in one mechanism, and only needs two numbers per client (`tokens`, `last_refill_time`).

**Other algorithms considered:**

| Algorithm | Trade-off |
|---|---|
| **Fixed Window Counter** | Simplest — a counter per time bucket — but a burst right at a window boundary lets a client get ~2x their limit in a few seconds |
| **Sliding Window Log** | Perfectly accurate — stores every request timestamp — but memory-expensive at scale (1000 requests/min/user = 1000 stored timestamps) |
| **Sliding Window Counter** | Approximates a sliding window with two fixed-window counters and a weighted average — good accuracy, minimal memory, but the math assumes traffic is evenly distributed within a window |
| **Token Bucket** (chosen) | Handles bursts naturally, cheap to store, used in production by companies like Stripe |

State is stored in **Redis**, shared by every gateway instance — otherwise each gateway would only see its own fraction of a client's traffic, the same problem as in-process rate limiting. Reads and the read-modify-write update are done atomically via a Lua script, since a plain `MULTI/EXEC` still leaves a race condition between the read and the calculation that precedes it.

---

## 5. Scaling to 1M Requests/Second

A single Redis instance handles roughly 50,000–100,000 rate-limit checks/second (each check needs at least one read and one write). To hit 1M/s, the token-bucket state is **sharded across ~10 Redis instances**, routed to via **consistent hashing** on the client identifier (user ID, IP, or API key) — so a given client's requests always land on the same shard, and adding/removing shards only reshuffles a small fraction of clients (see [Consistent Hashing](consistent-hashing.md)). In production this is usually just Redis Cluster, which handles the hash-slot routing automatically.

---

## 6. High Availability

When a Redis shard fails, two options:

| Option | Behavior | Risk |
|---|---|---|
| **Fail-open** | Allow all requests through while Redis is down | A traffic spike (often the same event that took Redis down) hits the backend completely unprotected |
| **Fail-closed** (chosen) | Reject all requests while Redis is down | Brief full outage of the API, but no cascading backend failure |

For a social-media-style platform, fail-closed wins: rate-limiter failures tend to coincide with traffic spikes — exactly when protection matters most. The better fix is preventing the Redis failure in the first place: **master-replica replication per shard**, with automatic failover (Redis Cluster supports this natively) so a single node failure doesn't take down a shard at all.

---

## 7. Key Technical Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|-----------------|
| **Placement** | Dedicated service | API Gateway | API Gateway — no extra hop, still centralized |
| **Algorithm** | Sliding Window Log (exact) | Token Bucket (approximate, cheap) | Token Bucket — handles bursts, minimal memory |
| **Sharding** | Single Redis instance | Sharded via consistent hashing | Sharded — required past ~100K checks/sec |
| **Failure mode** | Fail-open | Fail-closed | Fail-closed — protects against the exact spike that takes Redis down |

---

## Quick Reference: Technologies Used

| Technology | Use Case |
|------------|----------|
| Redis (Cluster) | Token bucket state, sharded and replicated |
| Lua scripting | Atomic read-modify-write for the rate-limit check |
| Consistent hashing | Routes a client to its Redis shard, minimizes remapping on resize |
| API Gateway | Enforcement point, closest to the edge |
