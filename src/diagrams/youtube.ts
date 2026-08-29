import { createShapeId, type Editor } from "tldraw";
import { ACCENT, ellipse, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: YouTube — upload/processing pipeline + streaming path
// (following docs/youtube-system-design.md)

export const VERSION = 6;

export function build(editor: Editor) {
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

  const requirementsPanelId = requirementsPanel(
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

  summaryPanel(editor, requirementsPanelId, "How it works — YouTube", [
    "The client asks the Video Service for a presigned URL and uploads the raw file directly to S3, bypassing the Gateway and app servers entirely.",
    "S3 fires an event notification that triggers the Upload Monitor (Lambda), which kicks off the Video Processing Service — splitting the video, transcoding in parallel to multiple resolutions, extracting audio, generating a transcript, and building the HLS/DASH manifest.",
    "Processed segments and manifests are written back to S3, and the Video Metadata DB is updated with the resulting S3 URLs and a status of ready.",
    "On playback, the client streams segments through the CDN (falling back to S3 on a cache miss), switching resolution based on the manifest for adaptive bitrate streaming.",
  ]);

  editor.zoomToFit();
}
