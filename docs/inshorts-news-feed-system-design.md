# Inshorts News Feed App System Design Summary

> Source: hand-written design notes (Search Service / Feed Service / Rabbit MQ, Core Entities, Functional & Non-Functional Requirements)

---

## 1. Requirements Gathering

### Functional Requirements
1. **List news articles** — Readers should be able to see the list of news articles
2. **Read an article** — Readers should be able to read any news article
3. **Search articles** — Readers should be able to search for news articles
4. **Publish articles** — Authors/publishers should be able to publish news articles

### Non-Functional Requirements
- **Low-latency reads** — the article list should load in **≤ 1 sec**
- **Low-latency search** — search results in **≤ 500 ms**
- **High ingestion throughput** — the system should absorb bursts of news articles being published at a high rate (e.g. breaking news) without degrading reads
- **High availability** — availability is prioritized over consistency (**AP over CP**); a reader seeing a slightly stale feed is preferable to the feed being unavailable

---

## 2. Core Entities

### Reader
- `id`
- `name`

### Article
- `id`
- `name`
- `content`
- `Author`

### Author
- `id`
- `name`
- `List<Article>`

---

## 3. High-Level Architecture

```
Readers → API Gateway → Feed Service ⇄ Redis Cache
                              ↓              ↓
                        Primary DB ──CDC──→ Elasticsearch ← Search Service
                              ↑
                        Rabbit MQ (publish events)
                              ↑
                       Authors / Publishers
```

### Key Components
| Component | Responsibility |
|-----------|----------------|
| **Search Service** | Queries **Elasticsearch** to search for any article (title, content, author) |
| **Feed Service** | Main news service — ingests articles from authors/publishers and serves the article list/detail reads |
| **Redis Cache** | Sits in front of the Feed Service; serves the latest/most-read articles so reads don't hit the primary DB every time, satisfying the ≤ 1 sec read requirement |
| **Rabbit MQ** (or any message queue) | Absorbs bursts of publish events during high-rate news ingestion, decoupling authors from downstream processing (indexing, cache invalidation, fan-out) |
| **CDC Pipeline** | Streams changes from the primary DB into Elasticsearch so search stays consistent with what's actually published |

---

## 4. Keeping Search Consistent (CDC)

Elasticsearch is a **derived, read-optimized copy** of the primary DB — it is never written to directly by the Feed Service. Instead:

1. Feed Service writes the new/updated article to the primary DB (source of truth)
2. A **CDC pipeline** (e.g. Debezium + Kafka, the same pattern used in the [Ticketmaster design](ticketmaster-system-design.md)) streams the change
3. Elasticsearch is updated asynchronously from the CDC stream

This keeps the primary DB and Elasticsearch **eventually consistent** without coupling the write path to the search index — a slow or unavailable Elasticsearch cluster never blocks publishing.

---

## 5. Absorbing High-Rate Publishing (Message Queue)

When many authors publish at once (e.g. breaking news), writing synchronously to the primary DB, cache, and search index on every request would create backpressure on the Feed Service. Instead:

1. Feed Service accepts the publish request and pushes an event onto **Rabbit MQ**
2. The Feed Service acknowledges the author immediately (fast write path)
3. Downstream consumers (DB writer, cache invalidation, search indexing) drain the queue at a sustainable rate

This is the same smoothing role Kafka plays in the [Ad Click Aggregator design](ad-click-aggregator-system-design.md), just for publish events instead of click events.

---

## 6. Caching Strategy

- **Cache-aside** in front of the Feed Service: on a read, check Redis first; on a miss, read the primary DB and populate the cache
- Cache the **latest / most-read articles** specifically — this is the working set that dominates read traffic and is what the ≤ 1 sec NFR is protecting
- Invalidate/update the cache when an article is edited, or let hot entries expire on a short TTL

---

## 7. Key Technical Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|-----------------|
| **Search sync** | Write-through to Elasticsearch | Async CDC | CDC — keeps the write path fast and decoupled |
| **Consistency vs. availability** | Strong consistency on reads | Eventual consistency, higher availability | Availability > Consistency, per the NFRs |
| **Publish path** | Synchronous write to all stores | Queue + async consumers | Queue (Rabbit MQ) — smooths high-rate ingestion spikes |
| **Read path** | Always hit primary DB | Cache-aside with Redis | Cache-aside — needed to hit the ≤ 1 sec NFR |

---

## Quick Reference: Technologies Used

| Technology | Use Case |
|------------|----------|
| Elasticsearch | Full-text article search |
| Redis | Cache-aside for the article feed |
| Rabbit MQ | Buffering/decoupling high-rate publish events |
| CDC (e.g. Debezium + Kafka) | Sync primary DB → Elasticsearch |
| Primary DB (relational) | Source of truth for readers, articles, authors |

---

## See Also

- [Ticketmaster System Design](ticketmaster-system-design.md) — same CDC-to-Elasticsearch pattern for search consistency
- [Ad Click Aggregator System Design](ad-click-aggregator-system-design.md) — same queue-based smoothing pattern for high-rate ingestion
