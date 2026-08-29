# Apache Druid & Apache Iceberg — Reference Guide

---

## Where They Fit in the Big Picture

Druid and Iceberg are often mentioned alongside Flink/Spark but serve **very different purposes**. They are not stream processors — they sit further downstream in the data pipeline.

```
DATA SOURCES          STREAMING LAYER        STORAGE / QUERY LAYER
─────────────         ───────────────        ─────────────────────
MySQL
Kafka    ──────►  Flink / Spark  ──────►    Apache Iceberg  (storage format)
Clickstream                                  Apache Druid    (query engine)
IoT Events
```

> Flink/Spark **process** the data.
> Iceberg **stores** it efficiently.
> Druid **serves** fast queries on top of it.

---

## Apache Druid — Simply Explained

### What is it?

Apache Druid is a **real-time analytics database** designed for sub-second queries on large volumes of event data. It was built at MetaMarkets in 2011 and is now used by companies like Airbnb, Netflix, and Lyft to power their analytics dashboards.

It is not a general-purpose database. It is purpose-built for one thing: **answering analytical questions on time-series event data, fast, even when millions of users are querying at once.**

Typical questions Druid is optimized for:
- *"How many ad impressions happened in the last 10 minutes, grouped by country?"*
- *"What is the p99 latency of our API over the past hour, per region?"*
- *"How many users completed checkout today vs. yesterday?"*

### Simple Analogy

> Druid is like a **pre-indexed newspaper archive**. Every article is already sorted, summarized, and indexed by date/topic so you can find answers instantly — rather than reading every article from scratch each time.

### Architecture

Druid is a distributed system made up of several specialized node types. Each node has one responsibility.

```
                        ┌──────────────────────────────────────────┐
                        │              DRUID CLUSTER               │
                        │                                          │
  ┌──────────┐          │  ┌─────────┐        ┌─────────────────┐ │
  │  Kafka / │          │  │  Router │        │   Coordinator   │ │
  │   Files  │          │  │(optional│        │ (manages segment │ │
  └────┬─────┘          │  │ gateway)│        │  assignment)    │ │
       │                │  └────┬────┘        └────────┬────────┘ │
       │                │       │                      │          │
       ▼                │       ▼                      ▼          │
  ┌──────────┐          │  ┌─────────┐        ┌─────────────────┐ │
  │MiddleMgr │          │  │  Broker │        │    Overlord     │ │
  │(Indexer) │          │  │(routes  │        │ (manages ingest │ │
  │real-time │          │  │ queries,│        │  tasks)         │ │
  │ingestion │          │  │ merges  │        └─────────────────┘ │
  └────┬─────┘          │  │results) │                            │
       │                │  └────┬────┘                            │
       ▼                │       │                                  │
  ┌──────────┐          │       ▼                                  │
  │ Segments │─────────►│  ┌─────────────────────────────────┐    │
  │(immutable│          │  │         Historical Nodes         │    │
  │  chunks) │          │  │  (serve queries on cold/warm     │    │
  └──────────┘          │  │   segments loaded from storage)  │    │
       │                │  └─────────────────────────────────┘    │
       ▼                │                                          │
  ┌──────────┐          └──────────────────────────────────────────┘
  │  Deep    │   ◄── Permanent segment storage (S3 / GCS / HDFS)
  │ Storage  │
  └──────────┘
```

**Node responsibilities at a glance:**

| Node | Role |
|---|---|
| **MiddleManager / Indexer** | Ingests real-time data from Kafka or batch files; creates segments |
| **Historical** | Loads and serves segments for completed time intervals (the workhorse for queries) |
| **Broker** | Receives SQL queries, fans out to Historical/MiddleManager nodes, merges results |
| **Coordinator** | Decides which Historical node should load which segment; handles rebalancing |
| **Overlord** | Manages and schedules ingestion tasks |
| **Router** | Optional entry point that routes queries to the right Broker |
| **Deep Storage** | S3/GCS/HDFS — durable, permanent home for all segments |

**What is a Segment?**
The core unit of Druid storage. Incoming data is batched into time-bounded chunks (e.g., one segment per hour), compressed in columnar format, and stored in Deep Storage. Historical nodes download hot segments into local disk for fast serving.

### Key Characteristics

- **Columnar storage** — only reads columns needed for a query, ignores the rest
- **Pre-aggregation (rollup)** — combines identical rows at ingestion time (e.g., 1000 click events → one row with count=1000), massively reducing storage and query cost
- **Time-based partitioning** — data is always segmented by time; time-range filters are extremely fast
- **Bitmap indexes** — pre-built indexes on dimension columns for instant filtering
- **Ingests directly from Kafka** — no intermediate Spark/Flink job needed for streaming ingestion

### Real-World Use Cases

| Company | How They Use Druid |
|---|---|
| **Airbnb** | Powers their Superset dashboards — real-time host/guest analytics at scale |
| **Netflix** | Monitors streaming quality metrics (buffering rate, bitrate) across millions of sessions in real time |
| **Lyft** | Real-time operational dashboards for ride supply/demand, pricing, and driver analytics |
| **Walmart** | Tracks product views, add-to-cart events, and inventory metrics across millions of SKUs |
| **Pinterest** | Ad analytics platform — serving campaign performance data to advertisers with sub-second latency |

**Common patterns:**
- **Ad tech** — impressions, clicks, conversions broken down by campaign/country/device in real time
- **Fintech** — transaction volume monitoring, fraud rate dashboards updated every few seconds
- **SaaS product analytics** — feature usage, funnel metrics, retention cohorts served to internal teams
- **Network monitoring** — infrastructure event logs queried in real time for anomaly detection

### Limitations

- Not great for **joins** between large tables
- Not a replacement for a general-purpose data warehouse
- Data updates/deletes are painful (it's append-optimized)
- Requires careful upfront schema design (rollup strategy, granularity) — hard to change later

---

## Apache Druid Architecture — Deep Explanation

### The Core Design Philosophy

Before diving into components, understand the guiding principle behind every design decision in Druid:

> Druid has a distributed architecture that is designed to be cloud-friendly and easy to operate. You can configure and scale services independently for maximum flexibility over cluster operations. This design includes enhanced fault tolerance: an outage of one component does not immediately affect other components.

Three words capture this: **independent, scalable, fault-tolerant.** Every component is deliberately separated so one failing piece doesn't bring down the entire system.

---

### The Three Server Types — The Physical Layout

Before understanding individual services, understand how Druid organises them into **three physical server groups**:

```
┌─────────────────────────────────────────────────────────────┐
│                    DRUID CLUSTER                            │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ MASTER SERVER │  │ QUERY SERVER  │  │  DATA SERVER   │  │
│  │               │  │               │  │                │  │
│  │ • Coordinator │  │ • Router      │  │ • Historical   │  │
│  │ • Overlord    │  │ • Broker      │  │ • Middle Mgr   │  │
│  │               │  │               │  │   + Peons      │  │
│  │ "The Manager" │  │ "The Waiter"  │  │ "The Kitchen"  │  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
│                                                             │
│  EXTERNAL DEPENDENCIES                                      │
│  • Deep Storage (S3 / HDFS)                                 │
│  • Metadata Storage (PostgreSQL / MySQL)                    │
│  • ZooKeeper                                                │
└─────────────────────────────────────────────────────────────┘
```

Think of it like a **restaurant**:
- **Master Server** = the restaurant manager — decides who works where, what gets cooked
- **Query Server** = the waiter — takes orders from customers, brings food back
- **Data Server** = the kitchen — stores ingredients, actually does the cooking

---

### Part 1 — The Master Server

The Master Server manages data ingestion and availability. It is responsible for starting new ingestion jobs and coordinating availability of data on the Data server. It divides operations between two services:

---

#### The Coordinator — The Librarian

Coordinator services watch over the Historical services on the Data servers. They are responsible for assigning segments to specific servers, and for ensuring segments are well-balanced across Historicals.

Think of the Coordinator as a **librarian managing bookshelves**:

```
Coordinator's job:
──────────────────
"I have 1TB of segment data and 5 Historical nodes.
 Which node should hold which segments?"

Historical Node 1 (500GB free) → assign segments A, B, C
Historical Node 2 (500GB free) → assign segments D, E, F
Historical Node 3 (500GB free) → assign segments G, H, I

Historical Node 2 crashes?
→ Coordinator detects it via ZooKeeper
→ Immediately reassigns its segments to Nodes 1 and 3
→ Downloads from Deep Storage
→ Cluster recovers automatically
```

The Coordinator also handles **segment balancing** — if one Historical node is overloaded with hot segments and another is idle, the Coordinator rebalances automatically. This is why you can add a new Historical node and Druid automatically migrates segments to it without any manual intervention.

**Scaling note:** The workload on the Coordinator increases with the number of segments. At very large scale — millions of segments — the Coordinator can become a bottleneck and needs its own dedicated machine.

---

#### The Overlord — The Factory Foreman

Overlord services watch over the Middle Manager services and are the controllers of data ingestion into Druid. They are responsible for assigning ingestion tasks to Middle Managers and for coordinating segment publishing.

The Overlord is the **job scheduler for ingestion**:

```
Someone submits an ingestion task:
"Ingest today's Kafka topic into Druid"

Overlord:
  1. Receives the task specification
  2. Looks at available Middle Managers
     → MM1: 4 slots free
     → MM2: 2 slots free
     → MM3: 0 slots free (busy)
  3. Assigns task to MM1 (most capacity)
  4. Monitors progress
  5. On completion → coordinates segment publishing
     → Segment appears in Metadata DB
     → Coordinator picks it up
     → Assigns to Historical node
```

The Overlord and Coordinator can be **combined into one process** for smaller clusters:

```
druid.coordinator.asOverlord.enabled = true
→ One JVM, two roles, simpler operations for small clusters
```

In large clusters with very high segment counts, separating them gives the Coordinator dedicated resources for segment balancing.

---

### Part 2 — The Query Server

The Query Server provides the endpoints that users and client applications interact with, routing queries to Data servers or other Query servers.

---

#### The Router — The Reception Desk

Router services provide a unified API gateway in front of Brokers, Overlords, and Coordinators. The Router also runs the Druid web console.

The Router is the **single front door** to the entire cluster:

```
External world sees only:
  http://druid-router:8888

Behind it:
  Router → Broker      (for queries)
  Router → Overlord    (for ingestion management)
  Router → Coordinator (for cluster management)

Without Router:
  Clients need to know which port is Broker,
  which is Overlord, which is Coordinator — messy.

With Router:
  One endpoint. One firewall rule.
  Router handles the internal routing.
```

The Router also hosts the **Druid web console** — a visual interface to submit ingestion specs, monitor running tasks, browse datasources and segments, and view cluster health.

---

#### The Broker — The Brain of Queries

Broker services receive queries from external clients and forward those queries to Data servers. When Brokers receive results from subqueries, they merge those results and return them to the caller.

The Broker is the **most intellectually interesting component** — this is where query intelligence lives:

```
Query arrives: "How many clicks from India, last 7 days?"

Broker thinks:
  "Last 7 days = segments from May 16 to May 23"
  "Which Historical nodes hold those segments?"
    → Historical 1: May 16, 17, 18 segments
    → Historical 2: May 19, 20, 21 segments
    → Historical 3: May 22 segment
  "Today's data (May 23) is still being ingested"
    → Middle Manager holds that in memory

Broker fans out 4 sub-queries simultaneously:
  → Historical 1: "count clicks from India, May 16–18"
  → Historical 2: "count clicks from India, May 19–21"
  → Historical 3: "count clicks from India, May 22"
  → Middle Manager: "count clicks from India, May 23"

All 4 respond. Broker merges:
  H1: 2.1M + H2: 1.8M + H3: 0.7M + MM: 0.3M = 4.9M

Returns 4.9M to caller in milliseconds.
```

The Broker also maintains an **in-memory cache** of segment results. If the same query runs again, it can return cached sub-results without hitting Historical nodes at all. This is why Druid can handle **thousands of concurrent queries** — each Broker parallelises work across the cluster automatically.

---

### Part 3 — The Data Server

The Data Server executes ingestion jobs and stores queryable data. It divides operations between Historical and Middle Manager services.

---

#### The Historical Service — The Workhorse

Historical services handle storage and querying on historical data. They download segments from deep storage and respond to queries about those segments. **They don't accept writes.**

```
Historical Node lifecycle:
──────────────────────────

1. Coordinator says: "Load segment X from Deep Storage"
2. Historical downloads segment X from S3 → local disk
3. Historical memory-maps the segment
   (maps file into virtual memory — reads without loading entirely into RAM)
4. Historical registers itself with ZooKeeper:
   "I am serving segment X"
5. Broker learns segment X is available on this Historical
6. Queries for segment X now route here

If Historical crashes:
  → Coordinator detects via ZooKeeper
  → Another Historical downloads segment X from S3
  → System self-heals, no data loss (S3 is the source of truth)
```

Historical nodes use **two-level caching** — hot segments stay in RAM, warm segments stay on fast local SSD — which is why queries are so fast.

---

#### The Middle Manager — The Ingestion Engine

Middle Manager services handle ingestion of new data. They are responsible for reading from external data sources and publishing new Druid segments.

```
Kafka topic → Middle Manager → Druid Segment → Deep Storage → Historical

What Middle Manager does internally:
  1.  Read events from Kafka
  2.  Parse and validate each event
  3.  Apply rollup (pre-aggregation)
  4.  Build columnar data structures in memory
  5.  Accumulate data (real-time segment)
  6.  Seal the segment periodically (handoff)
  7.  Push sealed segment to Deep Storage (S3)
  8.  Notify Overlord: "Segment X is published"
  9.  Overlord tells Coordinator
  10. Coordinator assigns to Historical node
  11. Historical downloads and serves it
  12. Middle Manager drops the real-time segment from memory
```

During steps 1–11, the Broker queries the **Middle Manager** for fresh data. After step 12, it queries the **Historical node**. This handoff is seamless — users see no interruption.

---

#### The Peon — The Task Worker

Peon services are task execution engines spawned by Middle Managers. Each Peon runs a **separate JVM** and is responsible for executing a single task.

```
Middle Manager (parent JVM)
    │
    ├── spawns → Peon 1 (separate JVM) → ingests Kafka partition 0
    ├── spawns → Peon 2 (separate JVM) → ingests Kafka partition 1
    └── spawns → Peon 3 (separate JVM) → ingests Kafka partition 2

Why separate JVMs?
  → Isolation: if Peon 1 crashes, Peons 2 and 3 keep running
  → Resource limits: each Peon gets its own memory allocation
  → Clean failure: a failed task doesn't corrupt the Middle Manager
```

---

#### The Indexer — The Modern Alternative

Indexer services are an alternative to Middle Managers and Peons. Instead of forking separate JVM processes per task, the Indexer runs tasks as individual **threads within a single JVM**.

```
MIDDLE MANAGER + PEONS          INDEXER
───────────────────────         ───────
Multiple JVM processes          Single JVM process
Strong process isolation        Thread-level isolation
More memory overhead            Shared memory pool (efficient)
Complex to tune (per-JVM config) Simpler to configure

Memory example:
  10 tasks × 512MB JVM overhead = 5GB wasted overhead
  vs.
  Indexer: 10 tasks share one JVM = much less overhead
```

---

### Part 4 — The Three External Dependencies

These are **external systems Druid depends on** — not Druid services. Understanding them is critical because they directly affect reliability.

---

#### Deep Storage — The Permanent Record

Deep storage is shared file storage (S3, GCS, HDFS) accessible by every Druid server. It serves two distinct purposes:

**Purpose 1 — Permanent backup:**

```
Historical Node (fast queries)     Deep Storage (S3)
───────────────────────────        ─────────────────
Segment X on local disk   ←──────  Segment X on S3 (permanent copy)

Historical crashes?
→ Re-download from S3 → No data loss ever
```

**Purpose 2 — Data transfer between services:**

```
Middle Manager finishes ingesting
→ Pushes segment to S3
→ Historical downloads from S3
→ They never talk directly to each other
→ S3 is the intermediary
```

**The fault tolerance guarantee:** You could lose **every single Historical node** simultaneously, provision new ones, and Druid would rebuild itself from S3. No data loss — just time to re-download.

**Querying cold data directly from Deep Storage:**

```
HOT data   → Historical nodes  (millisecond queries)
WARM data  → Historical nodes  (millisecond queries)
COLD data  → Query from S3 directly (seconds, but zero infra cost)

"Show me data from 3 years ago"
→ Don't load 3-year-old segments onto expensive Historical nodes
→ Query directly from S3, accept slower response
→ Massive cost saving
```

---

#### Metadata Storage — The Cluster Brain

Metadata Storage (PostgreSQL or MySQL) holds shared system metadata — segment registry, task history, ingestion specs, retention rules.

```
What lives in Metadata Storage:
────────────────────────────────
Segment registry:
  "Segment X exists, covers May 1–7,
   datasource=clickstream,
   location=s3://bucket/segment-x"

Task history:
  "Ingestion task #1234 ran May 23,
   created segments A, B, C, status=SUCCESS"

Rule configurations:
  "Keep last 90 days on Historical nodes,
   move older data to cold storage"
```

Why PostgreSQL? Because metadata needs **strong ACID consistency** — if two Coordinators disagree on which segments exist, the cluster breaks. A traditional SQL database is the right tool.

```
METADATA STORAGE              DEEP STORAGE
─────────────────             ────────────
"What segments exist?"        "The actual segment files"
Small (gigabytes)             Huge (petabytes)
PostgreSQL / MySQL            S3 / HDFS
Must be highly available      High throughput critical
```

---

#### ZooKeeper — The Nervous System

ZooKeeper handles internal service discovery, coordination, and leader election. While Metadata Storage tracks what data exists, ZooKeeper tracks what **nodes are alive right now**:

```
ZooKeeper watches:
──────────────────
"Which Historical nodes are currently running?"
"Which Middle Managers are available for new tasks?"
"Which Coordinator is the leader?" (only one active at a time)

When Historical Node 2 crashes:
  → Stops sending heartbeats to ZooKeeper
  → ZooKeeper declares it dead after timeout
  → Coordinator gets notified
  → Coordinator reassigns its segments to other Historicals
  → Broker stops routing queries to dead node
  → All within seconds, automatically
```

ZooKeeper also handles **leader election** — you run multiple Coordinator instances for redundancy, but only one is active. If the leader crashes, ZooKeeper elects a standby in seconds.

---

### The Colocation Decision — Small vs Large Clusters

**Small cluster — co-locate everything:**

```
Server 1: Master (Coordinator + Overlord)
Server 2: Query  (Router + Broker)
Server 3: Data   (Historical + Middle Manager)
Server 4: Data   (Historical + Middle Manager)
Server 5: Data   (Historical + Middle Manager)
```

**Large cluster — separate everything:**

At higher ingestion or query load, separate Historical from Middle Manager to avoid CPU and memory contention. Historical benefits from free memory for memory-mapped segments; Middle Manager needs CPU for parsing and indexing.

```
Server 1–2:   Coordinator (active + standby)
Server 3–4:   Overlord    (active + standby)
Server 5–8:   Broker      (multiple for query load)
Server 9–10:  Router
Server 11–20: Historical  (query-optimised, fast SSDs)
Server 21–26: Middle Manager (ingestion-optimised)
Server 27–29: ZooKeeper   (always odd number for quorum)
Server 30:    PostgreSQL  (Metadata Storage)
```

Why separate at scale:
```
HISTORICAL needs:          MIDDLE MANAGER needs:
─────────────────          ────────────────────
Fast SSDs                  Fast CPU (parsing, indexing)
Lots of RAM (memory maps)  Moderate RAM
Low CPU (just serving)     Network I/O (reading Kafka)
Stable, predictable load   Spiky, bursty load

Running them together at scale:
  Ingestion spike → Middle Manager uses all CPU
  → Historical queries slow down → users see latency spikes
```

---

### How Everything Connects — The Full Flow

**Query flow:**
```
1. User sends SQL query to Router
2. Router forwards to Broker
3. Broker consults ZooKeeper: "who has what segments?"
4. Broker fans out sub-queries to Historical nodes + Middle Manager
5. Each node executes query on its local segments in parallel
6. Results return to Broker
7. Broker merges all results
8. Returns final answer to Router → User
```

**Ingestion flow:**
```
1.  User submits ingestion spec to Router
2.  Router forwards to Overlord
3.  Overlord consults ZooKeeper: "which Middle Managers are free?"
4.  Overlord assigns task to Middle Manager
5.  Middle Manager spawns Peon(s)
6.  Peon reads from Kafka / S3 / files
7.  Peon builds segment in memory
8.  Peon pushes sealed segment to Deep Storage (S3)
9.  Peon notifies Overlord: "segment published"
10. Overlord updates Metadata Storage
11. Coordinator sees new segment in Metadata Storage
12. Coordinator assigns to Historical node via ZooKeeper
13. Historical downloads from S3 → local disk
14. Historical registers with ZooKeeper: "I serve this segment"
15. Broker learns from ZooKeeper: route future queries here
```

---

### One-Line Summary Per Component

| Component | Server Type | One-Line Job |
|---|---|---|
| **Router** | Query | Single front door — routes all external traffic |
| **Broker** | Query | Query brain — knows where data lives, fans out, merges results |
| **Coordinator** | Master | Librarian — assigns segments to Historical nodes, keeps balance |
| **Overlord** | Master | Foreman — assigns ingestion tasks to Middle Managers |
| **Historical** | Data | Bookshelf — stores and serves sealed segments at low latency |
| **Middle Manager** | Data | Factory floor — ingests raw data, builds segments |
| **Peon** | Data | Worker — executes one ingestion task, spawned by Middle Manager |
| **Indexer** | Data | Modern alternative to Middle Manager + Peon, single JVM |
| **Deep Storage** | External | Permanent record — S3/HDFS, source of truth for all segment data |
| **Metadata Storage** | External | Cluster registry — PostgreSQL tracking all segments and tasks |
| **ZooKeeper** | External | Nervous system — real-time node health and leader election |

---

## Apache Iceberg — Simply Explained

### What is it?

Apache Iceberg is an **open table format** for large-scale analytical datasets stored on cheap object storage like S3. It was created at Netflix in 2017 and is now used by Apple, Adobe, LinkedIn, and many others.

It is **not a database and not a query engine**. Think of it as the layer that sits between your raw data files (Parquet/ORC on S3) and your query engines (Spark, Flink, Trino). It brings **database-like guarantees** — transactions, schema evolution, time travel — to a data lake without any database server.

**The core idea:** Instead of just dumping files in S3 folders, Iceberg maintains a metadata layer that tracks exactly which files make up a table at any point in time. Query engines read this metadata to find only the files they need, rather than listing and scanning everything.

### Simple Analogy

> Iceberg is like a **smart filing cabinet with a perfect index**.
> Without it, your files are just dumped in a folder — finding anything means scanning everything.
> With Iceberg, every file is catalogued with metadata, so query engines know exactly which files to open.

### The Problem It Solves — Hive's Limitations

Before Iceberg, people used **Hive tables** on S3. The problems:

```
HIVE TABLES (old way)
─────────────────────
❌ No ACID transactions — concurrent writes corrupt data
❌ Updating/deleting a row = rewriting entire partition
❌ Schema changes break existing queries
❌ No time travel — can't query data as it was yesterday
❌ Slow metadata operations on millions of files

ICEBERG (new way)
──────────────────
✅ Full ACID transactions
✅ Row-level updates and deletes
✅ Schema evolution without breaking queries
✅ Time travel — query any historical snapshot
✅ Partition evolution — change partitioning without rewriting data
```

### Architecture — The Three Layers

Iceberg is built as three stacked layers. Each layer only knows about the layer below it.

```
  QUERY ENGINE (Spark / Flink / Trino / Athena)
        │
        │ "give me data from table 'orders'"
        ▼
┌──────────────────────────────────────────────────┐
│  LAYER 1 — CATALOG                               │
│                                                  │
│  Stores one pointer: "current metadata file      │
│  for table 'orders' is at s3://.../v3.json"      │
│                                                  │
│  Implementations: Hive Metastore, AWS Glue,      │
│  Apache Nessie, REST Catalog                     │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│  LAYER 2 — METADATA LAYER (on S3)                │
│                                                  │
│  metadata.json  ←── always points to latest      │
│  │  schema history                               │
│  │  partition spec                               │
│  │  list of snapshots                            │
│  │                                               │
│  ├── snapshot 1 (2024-01-01 09:00)               │
│  │       └── manifest-list-1.avro                │
│  │               └── manifest-a.avro             │
│  │                       ├── file_001.parquet    │
│  │                       └── file_002.parquet    │
│  │                                               │
│  └── snapshot 2 (2024-01-01 10:00) ◄── current  │
│          └── manifest-list-2.avro                │
│                  ├── manifest-a.avro (unchanged) │
│                  └── manifest-b.avro (new files) │
│                          └── file_003.parquet    │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│  LAYER 3 — DATA FILES (on S3 / GCS / HDFS)       │
│                                                  │
│  Parquet / ORC / Avro files                      │
│  (actual rows of data — never modified,          │
│   only new files are added or old ones deleted)  │
└──────────────────────────────────────────────────┘
```

**How a write works (e.g., INSERT):**
1. Write new Parquet files to S3
2. Create a new manifest file listing those files (with stats: row count, min/max per column)
3. Create a new snapshot pointing to new + existing manifests
4. Atomically update the catalog to point to the new metadata version

**How time travel works:**
The catalog still knows about old snapshots. To query yesterday's data, the engine simply reads snapshot 1's manifest list instead of snapshot 2's — no data was ever overwritten.

### Key Features

| Feature | What it means practically |
|---|---|
| **Time Travel** | `SELECT * FROM orders FOR SYSTEM_TIME AS OF '2024-01-01'` |
| **Schema Evolution** | Add/rename/drop columns — old files still readable without rewriting |
| **Partition Evolution** | Change partition strategy (e.g., daily → hourly) without migrating data |
| **ACID Transactions** | Two writers don't corrupt each other's data |
| **Hidden Partitioning** | Query `WHERE event_date = '2024-01-01'` — engine picks the right partition automatically |
| **Incremental reads** | "Give me only rows that changed since snapshot N" — used by Flink for CDC |

### Real-World Use Cases

| Company | How They Use Iceberg |
|---|---|
| **Netflix** | Stores petabytes of viewing history, member events, and content metadata; uses time travel to reprocess historical data with new business logic without re-ingesting |
| **Apple** | One of the largest known Iceberg deployments — exabyte-scale data lakehouse for internal analytics |
| **LinkedIn** | Migrated from Hive to Iceberg to handle schema evolution across hundreds of tables shared between teams |
| **Adobe** | Uses Iceberg as the storage layer for their real-time customer data platform, with Flink writing and Spark/Trino reading the same tables |
| **Airbnb** | Powers their data warehouse on top of Iceberg + Trino; schema evolution was the key driver (product changes break Hive schemas constantly) |

**Common patterns:**

- **GDPR / right to be forgotten** — delete a user's rows across all historical partitions with row-level deletes, no partition rewrite needed
- **Late-arriving data correction** — overwrite specific rows with corrected values (e.g., fixing a billing calculation bug retroactively)
- **Multi-engine data sharing** — Flink writes real-time events, Spark runs daily batch jobs, Trino serves ad-hoc SQL — all on the same Iceberg table with no coordination needed
- **Data versioning for ML** — train a model on the exact snapshot of data that existed on a specific date; reproduce results months later by querying the same snapshot

---

## Druid vs Iceberg — They're Not Competitors

This is a common confusion. They solve different problems:

| | Apache Druid | Apache Iceberg |
|---|---|---|
| **Type** | Query Engine + Storage | Storage Format / Table Format |
| **Purpose** | Fast analytical queries | Reliable data lake storage |
| **Handles queries?** | Yes, sub-second | No — needs Spark/Trino/Flink on top |
| **Real-time ingestion?** | Native | Via Flink/Spark |
| **Time Travel?** | Limited | Core feature |
| **Updates/Deletes?** | Painful | Row-level support |
| **Best for** | Dashboards, high-concurrency queries | Data lake reliability, compliance, ETL |

---

## How They All Fit Together — Full Modern Pipeline

```
                    ┌─────────────┐
                    │    KAFKA    │  (event streaming)
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │    FLINK    │          │    SPARK    │
       │  (real-time │          │  (batch ETL │
       │  processing)│          │  pipelines) │
       └──────┬──────┘          └──────┬──────┘
              │                        │
              └────────────┬───────────┘
                           ▼
                  ┌─────────────────┐
                  │ APACHE ICEBERG  │  (reliable storage on S3)
                  │  (data lake)    │
                  └────────┬────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │    DRUID    │          │   TRINO /   │
       │  (real-time │          │    SPARK    │
       │  dashboards)│          │  SQL queries│
       └─────────────┘          └─────────────┘
```

---

## One-Line Summaries

> **Kafka** — moves data between systems in real time
> **Flink / Spark** — transforms and processes that data
> **Iceberg** — stores that data reliably and efficiently on cheap object storage
> **Druid** — answers analytical questions on that data in milliseconds

---

*Last updated: May 2026*
*Systems covered: Apache Druid, Apache Iceberg*
