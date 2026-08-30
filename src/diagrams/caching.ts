import { createShapeId, type Editor } from "tldraw";
import { ellipse, notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: Caching — the five cache architectures, compared
// (following docs/caching.md, which itself mirrors Hello Interview's
// "Caching for System Design Interviews" guide)
//
// Like druid-iceberg.ts and message-queues.ts, this is a reference doc, not
// one system. The doc's own "Pattern Summary" table is the decision that
// actually matters in an interview — which of the five read/write patterns
// to pick — so that's what's drawn: five small App/Cache/DB diagrams side
// by side, each with the arrows that make that pattern's mechanism visibly
// different from the other four, rather than one generic "app talks to a
// cache" box repeated five times.

export const VERSION = 1;

export const SOURCE_DOC = "docs/caching.md";
export const SOURCE_DOC_HASH = "65d0b625d67e";

export function build(editor: Editor) {
  const id = () => createShapeId();

  // row 1 (y=0): Cache-Aside, Write-Through, Write-Behind
  // row 2 (y=950): Read-Through, Write-Around
  // column x-starts: 0, 1250, 2500

  const caApp = id();
  const caCache = id();
  const caDb = id();

  const wtApp = id();
  const wtCache = id();
  const wtDb = id();

  const wbApp = id();
  const wbCache = id();
  const wbDb = id();

  const rtApp = id();
  const rtCache = id();
  const rtDb = id();

  const waApp = id();
  const waCache = id();
  const waDb = id();

  editor.createShapes([
    // Cache-Aside (lazy loading) — col 1, row 1
    rect(caApp, 40, 260, 240, 120, "App Servers\n\nCache-Aside\n(lazy loading)"),
    ellipse(caCache, 420, 40, 180, 160, "Cache"),
    ellipse(caDb, 680, 260, 220, 200, "Database"),

    // Write-Through — col 2, row 1
    rect(wtApp, 1290, 260, 240, 120, "App Servers\n\nWrite-Through"),
    ellipse(wtCache, 1630, 270, 180, 160, "Cache"),
    ellipse(wtDb, 1930, 260, 220, 200, "Database"),

    // Write-Behind (write-back) — col 3, row 1
    rect(wbApp, 2540, 260, 240, 120, "App Servers\n\nWrite-Behind\n(write-back)"),
    ellipse(wbCache, 2880, 270, 180, 160, "Cache"),
    ellipse(wbDb, 3180, 260, 220, 200, "Database"),

    // Read-Through — col 1, row 2
    rect(rtApp, 40, 1210, 240, 120, "App Servers\n\nRead-Through"),
    ellipse(rtCache, 420, 990, 180, 160, "Cache\n(proxy)"),
    ellipse(rtDb, 680, 1210, 220, 200, "Database"),

    // Write-Around — col 2, row 2
    rect(waApp, 1290, 1210, 240, 120, "App Servers\n\nWrite-Around"),
    ellipse(waCache, 1630, 990, 180, 160, "Cache"),
    ellipse(waDb, 1930, 1210, 220, 200, "Database"),
  ]);

  editor.createShapes([
    // Cache-Aside: app checks cache, falls back to DB and populates on miss
    seg(id(), 280, 300, 420, 140, { text: "1. check cache", arrowEnd: "arrow" }),
    seg(id(), 280, 340, 680, 340, { text: "2. read DB as fallback,\nthen populate cache", arrowEnd: "arrow" }),

    // Write-Through: app writes to cache, cache synchronously writes to DB
    seg(id(), 1530, 320, 1630, 340, { text: "write to cache", arrowEnd: "arrow" }),
    seg(id(), 1810, 340, 1930, 340, { text: "sync write to DB\n(before ack)", arrowEnd: "arrow" }),

    // Write-Behind: app writes to cache, cache flushes to DB asynchronously
    seg(id(), 2780, 320, 2880, 340, { text: "write to cache", arrowEnd: "arrow" }),
    seg(id(), 3060, 340, 3180, 340, { text: "async flush\n(batched)", arrowEnd: "arrow", dash: "dashed" }),

    // Read-Through: app only ever talks to the cache; cache is the proxy to the DB
    seg(id(), 280, 1250, 420, 1090, { text: "reads only\n(app never talks\nto DB directly)", arrowEnd: "arrow" }),
    seg(id(), 600, 1090, 680, 1250, { text: "fetch on miss,\nstore, return", arrowEnd: "arrow" }),

    // Write-Around: writes bypass the cache entirely; reads populate it on miss
    seg(id(), 1530, 1300, 1930, 1300, { text: "write (bypasses\ncache)", arrowEnd: "arrow" }),
    seg(id(), 1530, 1260, 1630, 1110, { text: "read: check\ncache", arrowEnd: "arrow", dash: "dashed" }),
    seg(id(), 1710, 1090, 1930, 1260, { text: "miss → fetch,\npopulate cache", arrowEnd: "arrow", dash: "dashed" }),
  ]);

  const notesId = notesPanel(editor, "Key Concepts — Caching", [
    {
      heading: "Where to cache",
      items: [
        "External (Redis/Memcached) — shared across app servers, the default answer",
        "CDN — geographically distributed edge cache for static/media content",
        "Client-side — browser/device, limited backend control over freshness",
        "In-process — inside the app, fastest but not shared across instances",
      ],
    },
    {
      heading: "Eviction policies",
      items: [
        "LRU — evict least recently used; the safe default",
        "LFU — evict least frequently used; good for consistently popular keys",
        "FIFO — evict oldest by insertion time; rarely used, ignores usage",
        "TTL — expire after a fixed time; usually paired with LRU/LFU, not used alone",
      ],
    },
    {
      heading: "Common problems",
      items: [
        "Cache stampede — expiry causes a thundering herd on the DB; fix with request coalescing or cache warming",
        "Cache consistency — cache and DB briefly disagree after a write; invalidate on write or accept eventual consistency",
        "Hot keys — one key gets disproportionate traffic; fix by replicating the key or adding a local fallback cache",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — Caching", [
    "Caching exists because reading from a database costs a disk seek — an in-memory cache like Redis serves the same read in about 1ms versus 30-50ms from Postgres, roughly a 50x improvement, at the cost of extra staleness and failure-mode complexity.",
    "Cache-aside is the default: the app checks the cache first and only reads the database on a miss, populating the cache for next time. Write-through and write-behind route writes through the cache instead of around it, trading write latency (write-through, safer) for write throughput (write-behind, eventually consistent). Write-around skips the cache on writes entirely, useful when data is written often but rarely read.",
    "Two failure modes matter most in an interview: a cache stampede, where a popular key expiring sends a burst of simultaneous requests to the database at once, and cache consistency, where the cache and database briefly disagree after a write until the entry is invalidated or its TTL expires.",
    "The interview pattern is: identify the bottleneck with a real number (e.g. '500 req/s at 30ms each'), decide what's worth caching, pick an architecture that matches your consistency needs, set an eviction policy, and proactively address stampede/consistency/hot-key risk rather than waiting to be asked.",
  ]);

  editor.zoomToFit();
}
