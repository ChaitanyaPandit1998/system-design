import { createShapeId, type Editor } from "tldraw";
import { ACCENT, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: Inshorts News Feed — feed/search services, cache-aside reads,
// queue-buffered publishing, CDC-synced search index
// (following docs/inshorts-news-feed-system-design.md)

export const VERSION = 3;

export function build(editor: Editor) {
  const id = () => createShapeId();

  // row A — edge
  const readers = id();
  const authors = id();
  const gateway = id();

  // row B — services
  const feedService = id();
  const cache = id();
  const searchService = id();

  // row C — queue
  const rabbitMq = id();

  // row D — stores
  const primaryDb = id();
  const elastic = id();

  editor.createShapes([
    rect(readers, 60, 70, 220, 100, "Readers"),
    rect(authors, 60, 250, 220, 100, "Authors /\nPublishers"),
    rect(gateway, 460, 70, 300, 170, "API Gateway\n\n· auth\n· rate limit\n· route", {
      verticalAlign: "start",
    }),

    rect(feedService, 460, 480, 260, 160, "Feed Service"),
    rect(cache, 900, 480, 240, 160, "Redis Cache\n(latest / most-read\narticles)", { color: ACCENT }),
    rect(searchService, 1300, 480, 260, 160, "Search\nService"),

    rect(rabbitMq, 460, 900, 280, 160, "Rabbit MQ\n(publish events)", { color: ACCENT }),

    rect(primaryDb, 460, 1200, 280, 160, "Primary DB\n(source of truth:\narticles, authors)"),
    rect(elastic, 1300, 1200, 280, 160, "Elasticsearch\n(article search index)"),
  ]);

  editor.createShapes([
    // edge
    seg(id(), 280, 120, 460, 140, { text: "GET /feed, /search", arrowEnd: "arrow" }),
    seg(id(), 280, 300, 460, 200, { text: "POST /articles", arrowEnd: "arrow" }),

    // gateway routes reads/writes to Feed Service, search to Search Service
    seg(id(), 600, 240, 590, 480, { text: "route", arrowEnd: "arrow" }),
    seg(id(), 700, 240, 1430, 480, { text: "search()", arrowEnd: "arrow" }),

    // Feed Service reads through Redis before hitting the primary DB
    seg(id(), 720, 560, 900, 560, {
      text: "cache-aside\n(latest articles)",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    // Publishing goes through the queue, absorbing high-rate ingestion bursts
    seg(id(), 590, 640, 600, 900, {
      text: "publish event\n(high-rate ingestion)",
      arrowEnd: "arrow",
      color: ACCENT,
    }),
    seg(id(), 600, 1060, 600, 1200, { text: "write article", arrowEnd: "arrow" }),

    // Search Service queries Elasticsearch
    seg(id(), 1430, 640, 1440, 1200, { text: "query", arrowEnd: "arrow" }),

    // CDC keeps Elasticsearch consistent with the primary DB, routed below
    // both boxes so it never crosses either one
    seg(id(), 600, 1360, 600, 1440, { arrowEnd: "none", dash: "dashed" }),
    seg(id(), 600, 1440, 1440, 1440, {
      text: "CDC: Debezium + Kafka",
      arrowEnd: "none",
      dash: "dashed",
    }),
    seg(id(), 1440, 1440, 1440, 1360, { arrowEnd: "arrow", dash: "dashed" }),
  ]);

  const requirementsPanelId = requirementsPanel(
    editor,
    "Requirements — Inshorts News Feed",
    [
      "List news articles",
      "Read a news article",
      "Search for news articles",
      "Publish news articles (authors/publishers)",
    ],
    [
      "Low-latency reads — article list loads in ≤ 1 sec",
      "Low-latency search — results in ≤ 500 ms",
      "High ingestion throughput — absorb high-rate publishing bursts",
      "High availability — Availability > Consistency (AP over CP)",
    ]
  );

  summaryPanel(editor, requirementsPanelId, "How it works — Inshorts News Feed", [
    "Readers hit the Feed Service through a Redis cache-aside layer for the latest/most-read articles, so the hot read path rarely touches the primary DB — which is what keeps list/read latency under the 1-second requirement.",
    "Authors publish through the same Feed Service, but the write goes onto Rabbit MQ instead of hitting the DB synchronously, so a burst of breaking-news publishes doesn't back up either the write or the read path.",
    "A CDC pipeline (Debezium + Kafka) streams primary-DB changes into Elasticsearch asynchronously, so the Search Service always has a reasonably fresh, eventually-consistent index without being coupled to the write path.",
  ]);

  editor.zoomToFit();
}
