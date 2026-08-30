import { createShapeId, type Editor } from "tldraw";
import { ACCENT, notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: Apache Druid & Apache Iceberg — the modern real-time + lake pipeline
// (following docs/druid-iceberg.md)
//
// Unlike the request-flow diagrams (DropBox, Ticketmaster, ...), this doc
// isn't a single system with users and requirements — it's a reference
// comparing two technologies. The diagram worth drawing isn't either
// system's internals in isolation, but the doc's own "How They All Fit
// Together" pipeline: Kafka -> Flink/Spark -> Iceberg -> Druid/Trino. That's
// the actual decision-relevant picture — where each tool sits relative to
// the others, not an exhaustive component inventory.

export const VERSION = 1;

export const SOURCE_DOC = "docs/druid-iceberg.md";
export const SOURCE_DOC_HASH = "ded4e4f15d77";

export function build(editor: Editor) {
  const id = () => createShapeId();

  const kafka = id();
  const flink = id();
  const spark = id();
  const iceberg = id();
  const druid = id();
  const trino = id();

  editor.createShapes([
    rect(kafka, 460, 70, 280, 140, "Kafka\n(event streaming)"),

    rect(flink, 200, 430, 280, 160, "Flink\n(real-time processing)"),
    rect(spark, 740, 430, 280, 160, "Spark\n(batch ETL)"),

    rect(
      iceberg,
      380,
      800,
      520,
      230,
      "Apache Iceberg\n(data lake on S3)\n\ncatalog → metadata\n(snapshots + manifests)\n→ Parquet data files",
      { verticalAlign: "start", color: ACCENT }
    ),

    rect(
      druid,
      200,
      1230,
      320,
      210,
      "Druid\n(real-time dashboards)\n\nMaster + Query + Data\nservers — sub-second OLAP",
      { verticalAlign: "start" }
    ),
    rect(trino, 700, 1230, 320, 190, "Trino / Spark SQL\n(ad-hoc & batch queries)", {
      verticalAlign: "start",
    }),
  ]);

  editor.createShapes([
    seg(id(), 540, 210, 340, 430, { arrowEnd: "arrow" }),
    seg(id(), 660, 210, 880, 430, { arrowEnd: "arrow" }),

    seg(id(), 340, 590, 500, 800, { text: "write Parquet\n+ manifests", arrowEnd: "arrow" }),
    seg(id(), 880, 590, 780, 800, { text: "write Parquet\n+ manifests", arrowEnd: "arrow" }),

    seg(id(), 500, 1030, 360, 1230, { text: "load curated\nslices", arrowEnd: "arrow" }),
    seg(id(), 780, 1030, 860, 1230, { text: "direct SQL\n(no ingest needed)", arrowEnd: "arrow" }),
  ]);

  const notesId = notesPanel(editor, "Key Concepts — Druid & Iceberg", [
    {
      heading: "Apache Druid",
      items: [
        "Real-time OLAP database + query engine (not just storage)",
        "Three server types: Master (Coordinator+Overlord), Query (Router+Broker), Data (Historical+MiddleManager)",
        "External deps: Deep Storage, Metadata Store, ZooKeeper",
        "Best for: sub-second dashboards, high-concurrency queries",
      ],
    },
    {
      heading: "Apache Iceberg",
      items: [
        "An open table format, not a database or query engine",
        "Three layers: Catalog → Metadata (snapshots/manifests) → data files",
        "Brings ACID transactions, schema/partition evolution, and time travel to plain files on S3",
        "Best for: reliable lake storage, multi-engine sharing, compliance deletes",
      ],
    },
    {
      heading: "Not competitors",
      items: [
        "Iceberg is the lake: cheap, flexible, batch/ad-hoc",
        "Druid is the fast serving layer on top: expensive, real-time",
        "Common pattern: land data in Iceberg first, load curated slices into Druid",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — Druid & Iceberg", [
    "Kafka streams events in real time to two processors: Flink handles low-latency stream processing, Spark runs batch ETL — both write their output into Apache Iceberg tables on cheap object storage.",
    "Iceberg is a reliability layer, not a database: a catalog points to the current metadata file, which lists snapshots and manifests, which point to the actual Parquet files — giving plain files on S3 ACID transactions, schema evolution, and time travel without a database server.",
    "From there, two different engines serve two different needs: Druid ingests curated Iceberg data for sub-second, high-concurrency dashboards, while Trino or Spark SQL query Iceberg directly for ad-hoc and batch analytical SQL.",
    "They're not competitors — Iceberg is the reliable, cheap lake; Druid is the fast, expensive serving layer built on curated slices of that lake.",
  ]);

  editor.zoomToFit();
}
