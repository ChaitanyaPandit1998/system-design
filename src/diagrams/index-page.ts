import { createShapeId, type Editor } from "tldraw";
import { borderedTextPanel, textBlock } from "./shapes";

// Page: Index — a map of what's on the other 13 pages, so landing here cold
// doesn't mean scrolling a 13-item page dropdown blind. Two bordered panels
// (reusing the same card treatment as every other page's side panels, just
// centered here since there's no diagram sharing the canvas), grouping pages
// by kind: full "Design X" breakdowns vs. concept/comparison references —
// the same split every other page's Requirements-panel-vs-Key-Concepts-panel
// choice already reflects.

export const VERSION = 1;

const DESIGN_PAGES: [string, string][] = [
  ["DropBox", "file-sync architecture — gateway, file/sync services, event bus"],
  ["Ticketmaster", "search/booking/payment, distributed locks, hot-event waiting room"],
  ["YouTube", "upload pipeline, transcoding, streaming via CDN"],
  ["Ad Click Aggregator", "lambda architecture: Kafka/Flink real-time path + Spark reconciliation"],
  ["Inshorts", "news feed: cache-aside reads, queue-buffered publishing, CDC-synced search"],
  ["Distributed Rate Limiter", "API Gateway + sharded Token Bucket in Redis, fail-closed"],
  ["Uber", "fare estimation, geospatial matching, distributed-locked driver assignment"],
];

const CONCEPT_PAGES: [string, string][] = [
  ["Caching", "five cache architectures compared, side by side"],
  ["Message Queues", "RabbitMQ vs. Kafka vs. SQS: push vs. pull, log vs. queue"],
  ["Druid & Iceberg", "the modern pipeline: Kafka → Flink/Spark → Iceberg → Druid/Trino"],
  ["CAP Theorem", "the CP vs. AP choice during a network partition"],
  ["Consistent Hashing", "why modulo hashing breaks on resize, and how the ring bounds it"],
  ["Sharding", "range-based vs. hash-based vs. directory-based distribution"],
];

export function build(editor: Editor) {
  editor.createShapes([
    textBlock(
      createShapeId(),
      60,
      -140,
      1900,
      "System Design — Notes & Diagrams\n\nUse the page switcher (top-left dropdown) to jump to any page below. Every diagram is a real, editable tldraw board — drag things around, add notes, redraw whatever you like."
    ),
  ]);

  borderedTextPanel(
    editor,
    60,
    60,
    900,
    [
      "Design X — full system breakdowns",
      "",
      "Each has real functional/non-functional requirements,",
      "gathered the way an interview would.",
      "",
      ...DESIGN_PAGES.map(([name, desc]) => `${name} — ${desc}`),
    ].join("\n")
  );

  borderedTextPanel(
    editor,
    1110,
    60,
    900,
    [
      "Concepts & Comparisons — reference pages",
      "",
      "No single system with requirements to gather — these",
      "compare tools or trade-offs instead.",
      "",
      ...CONCEPT_PAGES.map(([name, desc]) => `${name} — ${desc}`),
    ].join("\n")
  );

  editor.zoomToFit();
}
