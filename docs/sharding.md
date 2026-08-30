# Sharding — Reference Guide

> Source: Hello Interview — "Sharding in System Design Interviews"

## Partitioning vs. Sharding

**Partitioning** splits a large table into smaller pieces *within a single database instance* — the data doesn't move to another machine. **Sharding** is horizontal partitioning *across multiple machines*: each shard is a standalone database holding a subset of the data, and together they make up the full dataset. In practice the terms are often used loosely — what matters is being clear about whether data lives on one machine or many.

## Choosing a Shard Key

The shard key is the field used to split the data. A good one has:

- **High cardinality** — many unique values (a boolean field caps you at 2 shards, no matter how you configure it)
- **Even distribution** — no single value should dominate (sharding by country is bad if 90% of users are in the US)
- **Alignment with query patterns** — your most common queries should hit exactly one shard; sharding users by `user_id` means "get this user's data" always hits a single shard

Good: `user_id` for a user-centric app, `order_id` for an e-commerce orders table. Bad: `is_premium` (only 2 values), `created_at` alone (all new writes go to the newest shard, an instant hot spot).

## Sharding Strategies

### Range-Based Sharding

Groups records by a continuous range of the shard key (e.g. user IDs 1–1M → Shard 1, 1M–2M → Shard 2). Simple, and supports efficient range scans. The problem: real access patterns rarely distribute evenly across ranges — sharding by `created_at` sends nearly all traffic to the newest shard, since users care about recent data. Works best when different users naturally query different ranges (e.g. multi-tenant SaaS, where each client owns a range of IDs).

### Hash-Based Sharding (the default)

`shard = hash(key) % N`. The hash function scrambles inputs, so data distributes evenly regardless of the raw key's distribution. The downside: changing the number of shards remaps almost every key, exactly the problem [consistent hashing](consistent-hashing.md) solves. This is the default and most common strategy — assume it unless you have a reason not to.

### Directory-Based Sharding

Uses a lookup table (`user_id → shard`) instead of a formula. Maximally flexible — you can move any one client to a dedicated shard, implement arbitrary rebalancing logic — but every request now needs a lookup first, adding latency and a critical single point of failure. Rarely the right answer in an interview: it introduces exactly the kind of follow-up questions (SPOF, extra hop) that are hard to defend.

## Challenges of Sharding

### Hot Spots and Load Imbalance

Even with a good shard key, one shard can end up handling disproportionate traffic — the "celebrity problem." If Taylor Swift's account lives on one shard, every view/like/message to her profile hits that shard, regardless of distribution strategy. Fixes: isolate hot keys to a dedicated shard, use compound shard keys (`hash(user_id + date)`) to spread a single hot user's data over time, or let the database dynamically split/migrate hot chunks (MongoDB does this automatically; Vitess supports operator-driven online resharding).

### Cross-Shard Operations

A query that doesn't align with the shard key ("top 10 posts globally" when sharded by `user_id`) has to hit every shard, wait for all responses, and merge them — 64x the network calls on a 64-shard cluster. Minimize this by: caching the aggregated result, denormalizing related data onto the same shard, or simply accepting the cost for genuinely rare queries (an admin dashboard loaded a few times a day). In an interview, "we'll query all shards and aggregate" for a *common* use case is a signal something needs rethinking.

### Maintaining Consistency

A transaction spanning two shards can't use a normal database transaction — the two shards don't know about each other. The textbook fix, two-phase commit, is slow and fragile (a stuck coordinator or shard can wedge the whole system); most production systems avoid it. Better options: **design to avoid cross-shard transactions** (keep all of a user's related data on one shard — the best solution), **use the saga pattern** for the cases you truly can't avoid (a sequence of steps with compensating actions to undo partial failures), or **accept eventual consistency** where a brief window of disagreement (e.g. a denormalized follower count) is fine.

## Sharding in Modern Databases

Most modern distributed databases handle sharding for you — you specify a partition key and the mechanics differ under the hood:

- **Cassandra** — a partitioner (e.g. Murmur3) with virtual nodes, a form of consistent hashing
- **DynamoDB** — hashes the partition key to internal partitions, splits/merges as they grow
- **MongoDB** — range-based chunks on the shard key (or ranges over the hash space, if using a hashed key), with a background balancer

SQL databases have matured here too: **Vitess** and **Citus** are sharding layers that sit in front of MySQL/PostgreSQL and handle routing, cross-shard operations, and resharding; AWS Aurora and Google Cloud Spanner offer distributed SQL with sharding built in.

## Sharding in an Interview

Don't shard prematurely — establish *why* a single database won't work first (storage, write throughput, or read throughput, ideally with real numbers). Then: identify the bottleneck, propose a shard key tied to your access patterns, choose a distribution strategy (default to hash-based with consistent hashing), and call out the resulting trade-offs (cross-shard queries, resharding). The number one mistake candidates make is proposing sharding before proving it's necessary.
