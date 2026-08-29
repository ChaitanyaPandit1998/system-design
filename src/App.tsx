import "tldraw/tldraw.css";
import { Tldraw, createShapeId, toRichText, type Editor, type TLPageId, type TLShapeId } from "tldraw";

const BLACK = "black" as const;
const ACCENT = "violet" as const;

// bump these when a builder below changes shape, to force a rebuild of a
// previously-persisted page instead of silently keeping the stale layout
const DROPBOX_VERSION = 2;
const TICKETMASTER_VERSION = 4;
const YOUTUBE_VERSION = 3;

function rect(
  id: TLShapeId,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: {
    align?: "start" | "middle" | "end";
    verticalAlign?: "start" | "middle" | "end";
    color?: typeof BLACK | typeof ACCENT;
    size?: "s" | "m";
  }
) {
  return {
    id,
    type: "geo" as const,
    x,
    y,
    props: {
      w,
      h,
      geo: "rectangle" as const,
      richText: toRichText(text),
      color: opts?.color ?? BLACK,
      fill: "none" as const,
      size: opts?.size ?? "s",
      font: "draw" as const,
      align: opts?.align ?? "middle",
      verticalAlign: opts?.verticalAlign ?? "middle",
    },
  };
}

function textBlock(id: TLShapeId, x: number, y: number, w: number, text: string) {
  return {
    id,
    type: "text" as const,
    x,
    y,
    props: {
      w,
      richText: toRichText(text),
      color: BLACK,
      size: "m" as const,
      font: "draw" as const,
      textAlign: "start" as const,
      autoSize: false,
      scale: 1,
    },
  };
}

// A requirements panel placed well clear of every diagram (far negative x),
// in the same functional/non-functional-requirements format used across the
// docs in docs/.
function requirementsPanel(
  editor: Editor,
  title: string,
  functional: string[],
  nonFunctional: string[]
) {
  const lines = [
    title,
    "",
    "Functional Requirements",
    ...functional.map((line) => `· ${line}`),
    "",
    "Non-Functional Requirements",
    ...nonFunctional.map((line) => `· ${line}`),
  ].join("\n");

  editor.createShapes([textBlock(createShapeId(), -900, 60, 700, lines)]);
}

function ellipse(id: TLShapeId, x: number, y: number, w: number, h: number, text: string) {
  return {
    id,
    type: "geo" as const,
    x,
    y,
    props: {
      w,
      h,
      geo: "ellipse" as const,
      richText: toRichText(text),
      color: BLACK,
      fill: "none" as const,
      size: "s" as const,
      font: "draw" as const,
      align: "middle" as const,
      verticalAlign: "middle" as const,
    },
  };
}

function seg(
  id: TLShapeId,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts?: {
    text?: string;
    arrowStart?: "none" | "arrow";
    arrowEnd?: "none" | "arrow";
    color?: typeof BLACK | typeof ACCENT;
    dash?: "draw" | "solid" | "dashed" | "dotted";
  }
) {
  return {
    id,
    type: "arrow" as const,
    x: x1,
    y: y1,
    props: {
      start: { x: 0, y: 0 },
      end: { x: x2 - x1, y: y2 - y1 },
      arrowheadStart: opts?.arrowStart ?? "none",
      arrowheadEnd: opts?.arrowEnd ?? "arrow",
      richText: toRichText(opts?.text ?? ""),
      color: opts?.color ?? BLACK,
      dash: opts?.dash ?? "draw",
      size: "s" as const,
      font: "draw" as const,
      bend: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Page 1: DropBox — client/gateway/file-sync architecture
// ---------------------------------------------------------------------------

function buildDropboxDiagram(editor: Editor) {
  const id = () => createShapeId();

  const outer = id();
  const client = id();
  const localDb = id();
  const localFolder = id();
  const gateway = id();
  const fileService = id();
  const syncService = id();
  const eventBus = id();
  const s3 = id();
  const fileMetadata = id();

  editor.createShapes([
    rect(outer, 100, 260, 330, 520, "", { size: "m" }),
    rect(client, 195, 300, 140, 130, "client", { size: "m" }),
    rect(localDb, 175, 460, 175, 95, "Local Db", { size: "m" }),
    rect(localFolder, 175, 590, 175, 95, "Local\nFolder", { size: "m" }),

    rect(
      gateway,
      500,
      290,
      240,
      470,
      "Gateway\n\n-Authentication\n-Rate Limiting\n-Load Balancing",
      { verticalAlign: "start", size: "m" }
    ),

    rect(fileService, 980, 290, 180, 120, "File\nService", { size: "m" }),
    rect(syncService, 970, 490, 200, 120, "Sync Service", { size: "m" }),
    rect(eventBus, 960, 710, 280, 120, "Event Bus", { size: "m" }),

    ellipse(s3, 1295, 65, 170, 170, "S3"),
    ellipse(fileMetadata, 1650, 490, 340, 280, "File\nMetadata\n(Dyanamo\nDB)"),
  ]);

  editor.createShapes([
    seg(id(), 265, 260, 265, 90, { arrowEnd: "none" }),
    seg(id(), 265, 90, 1380, 90, {
      text: "Upload/Download directly from S3",
      arrowEnd: "none",
    }),
    seg(id(), 1380, 90, 1380, 68, { arrowEnd: "arrow" }),

    seg(id(), 335, 430, 500, 520, { arrowStart: "arrow", arrowEnd: "arrow" }),

    seg(id(), 740, 400, 980, 340, {
      text: "uploadFile()\nFileMetadata\ngetfile(fileId)",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    seg(id(), 740, 560, 970, 545, {
      text: "getChanges()",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    seg(id(), 1070, 410, 1070, 490, { arrowStart: "arrow", arrowEnd: "arrow" }),
    seg(id(), 1070, 610, 1070, 710, { arrowStart: "arrow", arrowEnd: "arrow" }),

    seg(id(), 1240, 770, 1420, 770, { arrowEnd: "none" }),
    seg(id(), 1420, 770, 1420, 350, { arrowEnd: "none" }),
    seg(id(), 1420, 350, 1160, 350, { arrowEnd: "arrow" }),

    seg(id(), 1295, 150, 1150, 290, {
      text: "Request a\npresigned url",
      arrowEnd: "arrow",
    }),

    seg(id(), 1650, 570, 1160, 400, {
      text: "Write Metadata",
      arrowEnd: "arrow",
    }),
  ]);

  requirementsPanel(
    editor,
    "Requirements — DropBox",
    [
      "Upload a file from any device",
      "Download / sync files across all of a user's devices",
      "Detect and propagate file changes (sync)",
      "Support large files via direct-to-S3 transfer",
    ],
    [
      "High availability — sync keeps making progress if a peer is offline",
      "Eventual consistency across devices, no silent data loss",
      "Low latency metadata/sync calls, independent of file size",
      "Scalable to many users, many files and devices per user",
    ]
  );

  editor.zoomToFit();
}

// ---------------------------------------------------------------------------
// Page 2: Ticketmaster — search/booking/payment, locks, waiting room, CDC
// (following ticketmaster-system-design.md)
//
// Laid out in three well-separated rows (edge -> services -> stores) with
// wide gutters so arrow labels never have to share space with a box or
// another label.
// ---------------------------------------------------------------------------

function buildTicketmasterDiagram(editor: Editor) {
  const id = () => createShapeId();

  // row 1 — edge
  const users = id();
  const cdn = id();
  const lb = id();
  const gateway = id();
  const waitingRoom = id();

  // row 2 — services
  const search = id();
  const booking = id();
  const payment = id();

  // row 3 — stores
  const elastic = id();
  const postgres = id();
  const redis = id();
  const stripe = id();

  editor.createShapes([
    rect(users, 60, 100, 200, 110, "Users"),
    rect(cdn, 380, 100, 200, 110, "CDN"),
    rect(lb, 700, 100, 220, 110, "Load Balancer"),
    rect(gateway, 1040, 70, 280, 170, "API Gateway\n\n· auth\n· rate limit\n· route", {
      verticalAlign: "start",
    }),
    rect(
      waitingRoom,
      1500,
      70,
      340,
      200,
      "Virtual Waiting Room\n(hot events)\n\n· Redis sorted set\n· WebSocket updates\n· token admission",
      { verticalAlign: "start", color: ACCENT }
    ),

    rect(search, 920, 480, 240, 140, "Search\nService"),
    rect(booking, 1220, 480, 240, 140, "Booking\nService"),
    rect(payment, 1680, 480, 240, 140, "Payment\nService"),

    rect(elastic, 880, 900, 280, 160, "Elasticsearch\n(event search index)"),
    rect(postgres, 1220, 900, 280, 160, "PostgreSQL\n(source of truth:\nevents, bookings, users)"),
    rect(redis, 1560, 900, 280, 160, "Redis\n(distributed locks +\nwaiting-room queue)", {
      color: ACCENT,
    }),
    rect(stripe, 2060, 900, 220, 160, "Stripe"),
  ]);

  editor.createShapes([
    // edge chain
    seg(id(), 260, 155, 380, 155, { arrowEnd: "arrow" }),
    seg(id(), 580, 155, 700, 155, { arrowEnd: "arrow" }),
    seg(id(), 920, 155, 1040, 155, { arrowEnd: "arrow" }),

    // gateway -> waiting room (admission gate) -> booking (access token)
    seg(id(), 1320, 130, 1500, 130, {
      text: "gate\nadmission",
      arrowEnd: "arrow",
      color: ACCENT,
    }),
    seg(id(), 1600, 270, 1420, 480, {
      text: "token",
      arrowEnd: "arrow",
      color: ACCENT,
    }),

    // gateway -> search / booking (direct routes)
    seg(id(), 1100, 240, 1000, 480, { text: "search()", arrowEnd: "arrow" }),
    seg(id(), 1250, 240, 1280, 480, { text: "reserve()", arrowEnd: "arrow" }),

    // search -> elasticsearch
    seg(id(), 1040, 620, 1020, 900, { text: "query", arrowEnd: "arrow" }),

    // booking <-> postgres
    seg(id(), 1300, 620, 1340, 900, {
      text: "read / write",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    // booking <-> redis, distributed lock
    seg(id(), 1420, 620, 1620, 900, {
      text: "SETNX lock\nTTL 10m",
      arrowStart: "arrow",
      arrowEnd: "arrow",
      color: ACCENT,
    }),

    // booking <-> payment: booking asks for checkout, payment reports back the
    // result so booking can release the lock (per the payment-flow section)
    seg(id(), 1460, 550, 1680, 550, {
      text: "checkout()\nstatus: sold / failed",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    // payment -> stripe (charge) and stripe -> payment (webhook), kept apart
    seg(id(), 1740, 620, 2110, 900, { text: "charge", arrowEnd: "arrow" }),
    seg(id(), 2220, 900, 1860, 620, {
      text: "webhook",
      arrowEnd: "arrow",
      dash: "dashed",
    }),

    // CDC: postgres -> elasticsearch, routed below both boxes
    seg(id(), 1340, 1060, 1340, 1140, { arrowEnd: "none", dash: "dashed" }),
    seg(id(), 1340, 1140, 1020, 1140, {
      text: "CDC: Debezium + Kafka",
      arrowEnd: "none",
      dash: "dashed",
    }),
    seg(id(), 1020, 1140, 1020, 1060, { arrowEnd: "arrow", dash: "dashed" }),
  ]);

  requirementsPanel(
    editor,
    "Requirements — Ticketmaster",
    [
      "Search for events by date, location, performer, or genre",
      "Reserve and purchase tickets",
      "View bookings",
    ],
    [
      "High Availability — especially during high-demand sales",
      "Scalability — millions of concurrent users during popular events",
      "Low Latency — fast responses, particularly for seat selection",
      "Consistency — no double-booking of the same seat",
    ]
  );

  editor.zoomToFit();
}

// ---------------------------------------------------------------------------
// Page 3: YouTube — upload/processing pipeline + streaming path
// (following youtube-system-design.md)
// ---------------------------------------------------------------------------

function buildYoutubeDiagram(editor: Editor) {
  const id = () => createShapeId();

  // row 1 — edge
  const client = id();
  const gateway = id();

  // row 2 — services
  const cdn = id();
  const videoService = id();
  const metadataCache = id();
  const uploadMonitor = id();

  // row 3 — storage / processing
  const s3 = id();
  const metadataDb = id();
  const videoProcessing = id();

  editor.createShapes([
    rect(client, 60, 100, 200, 110, "Client"),
    rect(gateway, 700, 70, 280, 170, "API Gateway\n\n· auth\n· rate limit\n· route", {
      verticalAlign: "start",
    }),

    rect(cdn, 60, 480, 200, 140, "CDN\n(edge cache)"),
    rect(videoService, 700, 480, 240, 140, "Video Service"),
    rect(metadataCache, 1180, 480, 260, 140, "Video Metadata\nCache"),
    rect(
      uploadMonitor,
      1700,
      480,
      260,
      140,
      "Upload Monitor\n(Lambda)\n\ntriggered by S3\nevent notification",
      { verticalAlign: "start", color: ACCENT }
    ),

    ellipse(s3, 640, 900, 300, 240, "S3\n(video files,\nsegments,\nmanifests)"),
    rect(metadataDb, 1180, 900, 280, 180, "Video Metadata DB\n(videoId, uploaderId,\nchunks, S3 URLs, status)"),
    rect(
      videoProcessing,
      1700,
      900,
      400,
      300,
      "Video Processing\nService\n\n· split into segments\n· transcode (parallel workers)\n· audio processing\n· transcript generation\n· build + store manifest",
      { verticalAlign: "start", color: ACCENT }
    ),
  ]);

  editor.createShapes([
    // client -> gateway: upload initiation
    seg(id(), 260, 155, 700, 155, { text: "POST /presigned_url", arrowEnd: "arrow" }),

    // client <-> cdn: streaming reads
    seg(id(), 160, 210, 160, 480, { text: "GET /video\n(streaming)", arrowEnd: "arrow" }),

    // client -> S3: direct upload, bypassing the gateway entirely — routed
    // around the left margin so it doesn't cross any other box
    seg(id(), 60, 150, -80, 150, { arrowEnd: "none" }),
    seg(id(), -80, 150, -80, 1020, { arrowEnd: "none" }),
    seg(id(), -80, 1020, 640, 1020, {
      text: "PUT video directly to S3\n(bypasses gateway)",
      arrowEnd: "arrow",
    }),

    // gateway -> video service
    seg(id(), 840, 240, 820, 480, { text: "route", arrowEnd: "arrow" }),

    // video service -> S3: request a presigned URL
    seg(id(), 790, 620, 790, 900, { text: "getPresignedURL()", arrowEnd: "arrow" }),

    // video service <-> metadata cache <-> metadata DB
    seg(id(), 940, 550, 1180, 550, {
      text: "read / write metadata",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),
    seg(id(), 1310, 620, 1320, 900, {
      text: "cache-aside",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),

    // S3 -> upload monitor (event notification), routed through the open
    // gutter above row 3 so it never shares space with the cache-aside label
    seg(id(), 920, 910, 920, 700, { arrowEnd: "none", color: ACCENT, dash: "dashed" }),
    seg(id(), 920, 700, 1150, 700, {
      text: "S3 event notification",
      arrowEnd: "none",
      color: ACCENT,
      dash: "dashed",
    }),
    seg(id(), 1150, 700, 1830, 700, { arrowEnd: "none", color: ACCENT, dash: "dashed" }),
    seg(id(), 1830, 700, 1830, 620, { arrowEnd: "arrow", color: ACCENT, dash: "dashed" }),

    // upload monitor -> video processing (trigger)
    seg(id(), 1830, 620, 1900, 900, { text: "trigger pipeline", arrowEnd: "arrow", color: ACCENT }),

    // video processing writes results back to the metadata DB
    seg(id(), 1700, 950, 1460, 950, {
      text: "write S3 URLs, status: ready",
      arrowEnd: "arrow",
    }),

    // video processing -> S3, routed below every row-3 box so it never
    // crosses the metadata DB
    seg(id(), 1900, 1200, 1900, 1300, { arrowEnd: "none" }),
    seg(id(), 1900, 1300, 790, 1300, { text: "store segments + manifests", arrowEnd: "none" }),
    seg(id(), 790, 1300, 790, 1140, { arrowEnd: "arrow" }),
  ]);

  requirementsPanel(
    editor,
    "Requirements — YouTube",
    [
      "Upload a video",
      "Watch / stream a video (adaptive bitrate)",
      "Retrieve video metadata (title, description, thumbnail, resolutions)",
    ],
    [
      "Scalability — handle a large number of uploads and views per day",
      "Low latency streaming via CDN caching",
      "High availability & durability — an uploaded video must never be lost (S3)",
      "Loose coupling — upload and processing pipelines scale independently (event-driven)",
    ]
  );

  editor.zoomToFit();
}

function ensurePage(editor: Editor, pageId: TLPageId, version: number, build: (editor: Editor) => void) {
  editor.setCurrentPage(pageId);
  const meta = editor.getPages().find((p) => p.id === pageId)?.meta as { version?: number } | undefined;

  if (meta?.version !== version) {
    editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
    build(editor);
    editor.updatePage({ id: pageId, meta: { version } });
  }
}

function ensureNamedPage(editor: Editor, name: string, version: number, build: (editor: Editor) => void) {
  let page = editor.getPages().find((p) => p.name === name);
  if (!page) {
    editor.createPage({ name });
    page = editor.getPages().find((p) => p.name === name);
  }
  if (page) {
    ensurePage(editor, page.id, version, build);
  }
}

export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        persistenceKey="system-design-diagrams"
        onMount={(editor) => {
          const pages = editor.getPages();
          const firstPage = pages[0];

          if (firstPage.name === "Page 1") {
            editor.renamePage(firstPage, "DropBox");
          }

          ensurePage(editor, firstPage.id, DROPBOX_VERSION, buildDropboxDiagram);
          ensureNamedPage(editor, "Ticketmaster", TICKETMASTER_VERSION, buildTicketmasterDiagram);
          ensureNamedPage(editor, "YouTube", YOUTUBE_VERSION, buildYoutubeDiagram);

          editor.setCurrentPage(firstPage.id);
        }}
      />
    </div>
  );
}
