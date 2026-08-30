import { createShapeId, type Editor } from "tldraw";
import { ACCENT, ellipse, notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: Sharding — three distribution strategies compared
// (following docs/sharding.md)
//
// Same "draw the difference" approach as message-queues.ts and
// consistent-hashing.ts: three rows (range / hash / directory), each with
// the same server -> router -> shards shape, differing only in what the
// router uses to decide — which is exactly the decision an interview is
// testing.

export const VERSION = 1;

export const SOURCE_DOC = "docs/sharding.md";
export const SOURCE_DOC_HASH = "c569811bc650";

export function build(editor: Editor) {
  const id = () => createShapeId();

  // row y-starts: range=0, hash=650, directory=1300

  const rangeServer = id();
  const rangeRouter = id();
  const rangeShard1 = id();
  const rangeShard2 = id();
  const rangeShard3 = id();

  const hashServer = id();
  const hashRouter = id();
  const hashShard1 = id();
  const hashShard2 = id();
  const hashShard3 = id();

  const dirServer = id();
  const dirLookup = id();
  const dirShard1 = id();
  const dirShard2 = id();
  const dirShard3 = id();

  editor.createShapes([
    // Range-based
    rect(rangeServer, 40, 170, 200, 110, "Server"),
    rect(
      rangeRouter,
      340,
      140,
      340,
      170,
      "Range-Based\n\nuser_id 1–1M → Shard 1\nuser_id 1M–2M → Shard 2\nuser_id 2M–3M → Shard 3",
      { verticalAlign: "start" }
    ),
    ellipse(rangeShard1, 800, 40, 160, 140, "Shard 1"),
    ellipse(rangeShard2, 800, 195, 160, 140, "Shard 2"),
    ellipse(rangeShard3, 800, 350, 160, 140, "Shard 3"),

    // Hash-based (default)
    rect(hashServer, 40, 820, 200, 110, "Server"),
    rect(
      hashRouter,
      340,
      790,
      340,
      170,
      "Hash-Based (default)\n\nshard = hash(user_id) % N\nevenly distributed",
      { verticalAlign: "start", color: ACCENT }
    ),
    ellipse(hashShard1, 800, 690, 160, 140, "Shard 1"),
    ellipse(hashShard2, 800, 845, 160, 140, "Shard 2"),
    ellipse(hashShard3, 800, 1000, 160, 140, "Shard 3"),

    // Directory-based
    rect(dirServer, 40, 1470, 200, 110, "Server"),
    rect(
      dirLookup,
      340,
      1440,
      340,
      170,
      "Directory-Based\n\nlookup: user_to_shard[id]\nflexible, but adds a hop\nand a critical dependency",
      { verticalAlign: "start" }
    ),
    ellipse(dirShard1, 800, 1340, 160, 140, "Shard 1"),
    ellipse(dirShard2, 800, 1495, 160, 140, "Shard 2"),
    ellipse(dirShard3, 800, 1650, 160, 140, "Shard 3"),
  ]);

  editor.createShapes([
    // Range-based arrows
    seg(id(), 240, 225, 340, 210, { arrowEnd: "arrow" }),
    seg(id(), 680, 200, 800, 110, { text: "1–1M", arrowEnd: "arrow" }),
    seg(id(), 680, 240, 800, 265, { text: "1M–2M", arrowEnd: "arrow" }),
    seg(id(), 680, 280, 800, 420, { text: "2M–3M", arrowEnd: "arrow" }),

    // Hash-based arrows
    seg(id(), 240, 875, 340, 860, { arrowEnd: "arrow" }),
    seg(id(), 680, 850, 800, 760, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 680, 890, 800, 915, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 680, 930, 800, 1070, { arrowEnd: "arrow", color: ACCENT }),

    // Directory-based arrows
    seg(id(), 240, 1525, 340, 1510, { text: "lookup shard", arrowEnd: "arrow" }),
    seg(id(), 680, 1500, 800, 1410, { arrowEnd: "arrow" }),
    seg(id(), 680, 1540, 800, 1565, { arrowEnd: "arrow" }),
    seg(id(), 680, 1580, 800, 1720, { arrowEnd: "arrow" }),
  ]);

  const notesId = notesPanel(editor, "Key Concepts — Sharding", [
    {
      heading: "Choosing a shard key",
      items: [
        "High cardinality — many unique values (not a boolean)",
        "Even distribution — no single value dominates",
        "Aligns with queries — the common case should hit exactly one shard",
      ],
    },
    {
      heading: "Sharding strategies",
      items: [
        "Range-based — simple, supports range scans, but hot spots on sequential keys (created_at)",
        "Hash-based — the default; even distribution, but resharding remaps most keys",
        "Directory-based — most flexible, but adds a lookup hop and a single point of failure",
      ],
    },
    {
      heading: "Common problems",
      items: [
        "Hot spots — one shard (a celebrity user) gets disproportionate traffic; isolate to a dedicated shard or use compound keys",
        "Cross-shard queries — expensive; minimize with caching, denormalization, or accepting the hit for rare queries",
        "Cross-shard transactions — avoid by design (keep related data on one shard), or use the saga pattern",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — Sharding", [
    "Sharding is what you do when a single database can't handle your scale anymore — you split data across multiple independent machines, each holding a subset of the full dataset.",
    "Two decisions matter most: the shard key (needs high cardinality, even distribution, and alignment with your query patterns) and the distribution strategy (how that key maps to a shard). Get either wrong and you get hot spots or expensive cross-shard queries.",
    "Hash-based sharding is the default: hash(key) % N distributes data evenly, but resharding remaps almost every key — the same problem consistent hashing solves. Range-based sharding supports efficient range scans but concentrates load on whichever range is 'hot' right now. Directory-based sharding is the most flexible via a lookup table, but adds a hop to every request and a critical dependency on the directory service.",
    "In an interview: identify the bottleneck (storage, write throughput, or read throughput) with a real number, propose a shard key tied to your access patterns, default to hash-based with consistent hashing, and call out the resulting trade-off — cross-shard queries get expensive, so minimize them by design.",
  ]);

  editor.zoomToFit();
}
