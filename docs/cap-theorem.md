# CAP Theorem — Reference Guide

> Source: Hello Interview — "CAP Theorem for System Design Interviews"

## What Is CAP Theorem?

In a distributed system, you can only have two out of three of the following properties:

- **Consistency** — all nodes see the same data at the same time; a read after a write always returns the updated value
- **Availability** — every request to a non-failing node receives a response, without a guarantee it's the most recent data
- **Partition Tolerance** — the system keeps working despite network partitions between nodes

Note: "consistency" here is different from ACID consistency in a traditional database.

## The Practical Reality

In any real distributed system, **partition tolerance is non-negotiable** — network failures will happen, and the system has to survive them. That collapses CAP theorem into a single practical question:

> **When a network partition occurs, do you prioritize consistency or availability?**

### Example: USA / Europe Servers

A user updates their profile on a USA server; the update replicates to a Europe server. If the link between them goes down mid-replication, a user reading from Europe faces a choice:

- **Choose consistency (CP)** — return an error rather than risk stale data
- **Choose availability (AP)** — return the old (stale) value rather than nothing

The right answer depends entirely on the system.

### When to Choose Consistency

- **Ticket booking** — two people must never be sold the same seat
- **E-commerce inventory** — overselling the last item in stock is a real cost
- **Financial systems** — stale order books lead to trades at the wrong price

### When to Choose Availability

Most systems can tolerate eventual consistency — the system converges within seconds or minutes:

- **Social media** — a stale profile picture for a few minutes is fine
- **Content platforms** (Netflix) — a stale movie description isn't catastrophic
- **Review sites** (Yelp) — slightly outdated hours beat no information at all

The test: *"Would it be catastrophic if users briefly saw inconsistent data?"* Yes → consistency. No → availability.

## Where This Fits in an Interview

CAP theorem should be one of the first things discussed when moving into non-functional requirements — it drives real design choices:

**Prioritizing consistency** points toward: distributed transactions (two-phase commit), single-node solutions, or databases like PostgreSQL/MySQL, Google Spanner, DynamoDB in strong-consistency mode.

**Prioritizing availability** points toward: multiple async replicas, CDC-based propagation, or databases like Cassandra, DynamoDB (multi-AZ), Redis clusters.

## Real Systems Choose Per-Feature, Not System-Wide

Most modern systems need both — for different features:

| System | Needs Consistency | Can Prefer Availability |
|---|---|---|
| **Ticketmaster** | Booking a seat (no double-booking) | Viewing event details |
| **Tinder** | Matching (both users see it immediately) | Viewing a profile |

## Levels of Consistency

- **Strong consistency** — every read reflects the most recent write; expensive, needed for bank balances
- **Causal consistency** — related events (a post and its comments) appear in order to everyone
- **Read-your-own-writes** — you always see your own updates immediately; others may lag
- **Eventual consistency** — the system converges over time; the default when prioritizing availability (e.g. DNS)

## Conclusion

CAP theorem doesn't need to be complicated: ask *"does every read need to see the most recent write?"* Yes → prioritize consistency. No → prioritize availability. Real systems often answer this differently per feature, not once for the whole system.
