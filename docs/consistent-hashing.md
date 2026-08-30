# Consistent Hashing — Reference Guide

> Source: Hello Interview — "Consistent Hashing for System Design Interviews"

## The Problem: Simple Modulo Hashing

The obvious way to distribute data across N databases is `database_id = hash(key) % N`. This works — until N changes.

Adding a 4th database changes the formula from `% 3` to `% 4`. That doesn't just affect the new instance — it changes which database *almost every key* maps to, because the modulo of most numbers changes when the divisor changes. The result: massive, unnecessary data movement and a spike in database load, triggered by adding a single node. Removing a node has the same problem.

## Consistent Hashing

Consistent hashing solves this by arranging both data and servers on a **hash ring** — a circular space (conceptually 0 to 2³²-1).

1. Place database nodes at points around the ring
2. To find where a key lives, hash the key, then walk clockwise until you hit a node
3. Adding or removing a node only affects the keys between it and its counter-clockwise neighbor — everything else stays exactly where it was

**Adding a database**: only the keys in the arc between the new node and its predecessor move to it. In a 4-node ring, that's roughly 1/N of the keys — far less than the ~75%+ that modulo hashing would remap.

**Removing a database**: only the keys that were on the failed node move — to its clockwise neighbor. Everything else is untouched.

## Virtual Nodes

Without virtual nodes, when a database fails, *all* of its keys move to a single clockwise neighbor — doubling that neighbor's load. The fix: place each physical database at **many** points on the ring (hash "DB1-vn1", "DB1-vn2", etc.), so a failed node's load is spread evenly across many neighbors instead of dumped on one. The more virtual nodes per database, the more even the resulting distribution.

## Consistent Hashing Doesn't Fix Hot Spots

Consistent hashing distributes **keys** evenly — it says nothing about **traffic**. A single very popular key (a viral post, a celebrity's profile) can still overload the one node it lives on. Fixes:

- **Read replicas** — replicate popular keys and load-balance reads across them (most common)
- **Key-space salting** — append a random suffix to hot keys (`taylor-swift-{0..9}`) so they spread across nodes
- **Adaptive rebalancing** — monitor traffic and move specific key ranges off overloaded nodes (operationally complex; DynamoDB does this automatically)

**The distinction**: virtual nodes prevent *structural* imbalance (uneven key distribution). Replication and salting prevent *workload* imbalance (uneven traffic).

## Consistent Hashing and Replication

Consistent hashing tells you where data *should* live — it doesn't move terabytes of data the instant a node fails. In practice, distributed databases pair it with replication so failures don't require any data movement at all:

- **DynamoDB** replicates each partition across 3 availability zones; a replica is promoted via a consensus algorithm (Raft) on failure
- **Cassandra** replicates data to N consecutive nodes on the ring, so reads are served from surviving replicas

Data movement really only happens during *planned* membership changes (adding capacity, permanently replacing a node) — and even then, consistent hashing bounds it to a fraction of the dataset, not all of it.

## Where It's Used

- **Apache Cassandra** — consistent hashing to distribute data across the ring
- **Amazon DynamoDB** — under the hood for partition placement
- **CDNs** — to determine which edge server caches which content

Not every distributed system uses it: **Redis Cluster** uses fixed hash slots instead (16,384 slots via `CRC16(key) mod 16384`) — simpler to reason about, at the cost of more manual coordination when rebalancing. The choice between consistent hashing and fixed hash slots is itself a real design trade-off.

## When to Bring This Up in an Interview

Most systems built on DynamoDB, Cassandra, etc. handle this for you — it's enough to mention that the database uses consistent hashing (or a variant) under the hood. Go deeper only in infrastructure-focused interviews where you're designing a distributed system from scratch: a distributed database, cache, or message broker.
