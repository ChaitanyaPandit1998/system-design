import { createShapeId, type Editor } from "tldraw";
import { ellipse, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: DropBox — client/gateway/file-sync architecture

// bump when this builder changes shape, to force a rebuild of a
// previously-persisted page instead of silently keeping the stale layout
export const VERSION = 5;

// tracked by scripts/check-doc-sync.mjs (npm run check-docs) — update
// SOURCE_DOC_HASH after reviewing this diagram against a change to the doc
export const SOURCE_DOC = "docs/dropbox-system-design.md";
export const SOURCE_DOC_HASH = "1c40ee684c8b";

export function build(editor: Editor) {
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

  const requirementsPanelId = requirementsPanel(
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

  summaryPanel(editor, requirementsPanelId, "How it works — DropBox", [
    "The client keeps a local DB and folder in sync with the cloud through the Gateway, which handles auth/rate-limiting and routes control-plane calls to the File Service (upload/download, metadata) and the Sync Service (getChanges()).",
    "File bytes never touch the app servers: the client uploads and downloads directly to/from S3 using a presigned URL issued by the File Service.",
    "Changes are published on the Event Bus so other devices learn what changed and pull the update by calling getChanges() on the Sync Service.",
  ]);

  editor.zoomToFit();
}
