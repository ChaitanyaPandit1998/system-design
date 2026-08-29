import { createShapeId, type Editor } from "tldraw";
import { ACCENT, ellipse, rect, requirementsPanel, seg } from "./shapes";

// Page: Ad Click Aggregator — lambda architecture (real-time + batch)
// (following docs/ad-click-aggregator-system-design.md)
//
// Same layout discipline as the other pages: wide row/column gutters, short
// arrow labels, and event-driven branches (Kafka -> Flink / S3) routed so
// they never cross a box.

export const VERSION = 1;

export function build(editor: Editor) {
  const id = () => createShapeId();

  // row A — edge
  const browser = id();
  const gateway = id();

  // row B — request-path services
  const adPlacement = id();
  const cache = id();
  const clickProcessor = id();

  // row C — ingestion
  const kafka = id();

  // row D — stream processing / raw archive
  const flink = id();
  const s3Raw = id();

  // row E — serving & correction
  const olap = id();
  const reconciliation = id();
  const analyticsService = id();
  const advertiser = id();

  editor.createShapes([
    rect(browser, 60, 100, 200, 110, "Browser\n(Client)"),
    rect(gateway, 460, 70, 300, 170, "Load Balancer +\nAPI Gateway\n\n· SSL termination\n· rate limiting\n· routing", {
      verticalAlign: "start",
    }),

    rect(adPlacement, 60, 480, 260, 160, "Ad Placement\nService + Ad DB"),
    rect(cache, 460, 480, 240, 160, "Cache (Redis)\nimpression IDs,\nTTL 24-48h", { color: ACCENT }),
    rect(clickProcessor, 900, 480, 260, 160, "Click\nProcessor"),

    rect(kafka, 900, 900, 260, 160, "Kafka\n(ad-clicks topic)"),

    rect(flink, 700, 1320, 280, 200, "Flink\n\n· 1-min tumbling windows\n· watermarks for late events", {
      verticalAlign: "start",
    }),
    ellipse(s3Raw, 1120, 1320, 280, 240, "S3\n(raw click\narchive)"),

    rect(olap, 700, 1780, 280, 200, "OLAP DB\n(ClickHouse / Druid)\n\naggregated click counts", {
      verticalAlign: "start",
    }),
    rect(
      reconciliation,
      1180,
      1780,
      300,
      200,
      "Reconciliation\nWorker + Spark\n\nbatch reprocess,\ncompare & correct",
      { verticalAlign: "start", color: ACCENT }
    ),
    rect(analyticsService, 1620, 1780, 260, 200, "Analytics\nService"),
    rect(advertiser, 2020, 1820, 200, 140, "Advertiser"),
  ]);

  editor.createShapes([
    // edge
    seg(id(), 260, 155, 460, 155, { arrowEnd: "arrow" }),

    // gateway -> ad placement (serving) / click processor (tracking)
    seg(id(), 530, 240, 190, 480, { text: "GET /ads", arrowEnd: "arrow" }),
    seg(id(), 690, 240, 1030, 480, { text: "POST /click", arrowEnd: "arrow" }),

    // idempotency: ad placement stores impression id, click processor checks it
    seg(id(), 320, 560, 460, 560, { text: "store impression ID\n(TTL 24-48h)", arrowEnd: "arrow" }),
    seg(id(), 900, 560, 700, 560, {
      text: "check + mark used\n(idempotency)",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    // click processor -> kafka
    seg(id(), 1030, 640, 1030, 900, { text: "publish click event", arrowEnd: "arrow" }),

    // kafka fans out to two consumer groups: real-time + archival
    seg(id(), 960, 1060, 840, 1320, { text: "consume\n(real-time)", arrowEnd: "arrow" }),
    seg(id(), 1100, 1060, 1220, 1320, {
      text: "consume\n(archival)",
      arrowEnd: "arrow",
      dash: "dashed",
    }),

    // flink -> OLAP DB, S3 -> reconciliation
    seg(id(), 840, 1520, 840, 1780, { text: "write aggregates", arrowEnd: "arrow" }),
    seg(id(), 1220, 1560, 1330, 1780, { text: "batch read", arrowEnd: "arrow" }),

    // reconciliation corrects the OLAP DB
    seg(id(), 1180, 1850, 980, 1850, {
      text: "compare &\ncorrect",
      arrowEnd: "arrow",
      dash: "dashed",
    }),

    // analytics service queries OLAP DB, routed below the reconciliation box
    seg(id(), 840, 1980, 840, 2080, { arrowEnd: "none" }),
    seg(id(), 840, 2080, 1750, 2080, { text: "query aggregates", arrowEnd: "none" }),
    seg(id(), 1750, 2080, 1750, 1980, { arrowEnd: "arrow" }),

    // advertiser -> analytics service
    seg(id(), 2020, 1890, 1880, 1880, { text: "GET /analytics", arrowEnd: "arrow" }),
  ]);

  requirementsPanel(
    editor,
    "Requirements — Ad Click Aggregator",
    [
      "Capture every ad click with metadata (ad, user, timestamp)",
      "Aggregate clicks in real time by ad, advertiser, and time period",
      "Support fast analytics queries for advertisers",
      "Detect and filter invalid or fraudulent clicks",
    ],
    [
      "High Availability — 99.99% uptime for critical path components",
      "Real-time processing — sub-second latency for click ingestion",
      "Idempotency — no double-counting duplicate click events",
      "Scalability — handle traffic spikes (10,000+ clicks/sec)",
    ]
  );

  editor.zoomToFit();
}
