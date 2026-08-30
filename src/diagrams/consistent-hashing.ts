import { createShapeId, type Editor } from "tldraw";
import { ACCENT, ellipse, notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: Consistent Hashing — modulo's redistribution problem vs. the ring
// (following docs/consistent-hashing.md)
//
// The comparison that matters isn't "here is a ring" in isolation — it's
// *why* the ring exists: modulo hashing remaps almost everything when N
// changes, the ring only remaps a small arc. So this draws both, side by
// side, same "draw the difference" approach as message-queues.ts.

export const VERSION = 1;

export const SOURCE_DOC = "docs/consistent-hashing.md";
export const SOURCE_DOC_HASH = "686c4a944c0a";

export function build(editor: Editor) {
  const id = () => createShapeId();

  // ---- Left: modulo hashing (before / after adding a 4th DB) ----
  const beforeLabel = id();
  const db1a = id();
  const db2a = id();
  const db3a = id();

  const afterLabel = id();
  const db1b = id();
  const db2b = id();
  const db3b = id();
  const db4b = id();

  editor.createShapes([
    rect(beforeLabel, 60, 60, 700, 90, "Modulo hashing — before: hash(key) % 3", { size: "m" }),
    ellipse(db1a, 60, 200, 160, 140, "DB 1"),
    ellipse(db2a, 300, 200, 160, 140, "DB 2"),
    ellipse(db3a, 540, 200, 160, 140, "DB 3"),

    rect(afterLabel, 60, 560, 700, 90, "After adding DB 4 — hash(key) % 4", { size: "m" }),
    ellipse(db1b, 20, 700, 150, 130, "DB 1"),
    ellipse(db2b, 210, 700, 150, 130, "DB 2"),
    ellipse(db3b, 400, 700, 150, 130, "DB 3"),
    ellipse(db4b, 590, 700, 150, 130, "DB 4"),
  ]);

  editor.createShapes([
    seg(id(), 140, 340, 100, 700, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 380, 340, 290, 700, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 620, 340, 480, 700, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 700, 400, 665, 700, {
      text: "~75% of ALL keys remap\n(not just the new DB's share)",
      arrowEnd: "arrow",
      color: ACCENT,
    }),
  ]);

  // ---- Right: the hash ring ----
  // ring centered at (1900, 460), radius 280 — node positions computed by
  // hand at 0°(top)/90°/180°/270° plus 45° for the newly-added DB5
  const ringOutline = id();
  const dbTop = id(); // 0°  (1900, 180)
  const dbRight = id(); // 90° (2180, 460)
  const dbBottom = id(); // 180°(1900, 740)
  const dbLeft = id(); // 270°(1620, 460)
  const dbNew = id(); // 45° (2098, 262) — DB5, newly added

  editor.createShapes([
    ellipse(ringOutline, 1620, 180, 560, 560, ""),
    ellipse(dbTop, 1855, 135, 90, 90, "DB1"),
    ellipse(dbRight, 2135, 415, 90, 90, "DB2"),
    ellipse(dbBottom, 1855, 695, 90, 90, "DB3"),
    ellipse(dbLeft, 1575, 415, 90, 90, "DB4"),
    ellipse(dbNew, 2053, 217, 90, 90, "DB5\n(new)"),
  ]);

  editor.createShapes([
    seg(id(), 1970, 200, 2070, 240, {
      text: "only the keys between\nDB1 and DB5 move",
      arrowEnd: "arrow",
      color: ACCENT,
    }),
    seg(id(), 900, 460, 1620, 460, {
      text: "same idea, arranged on a ring\ninstead of a straight line",
      arrowEnd: "none",
      dash: "dashed",
    }),
  ]);

  const notesId = notesPanel(editor, "Key Concepts — Consistent Hashing", [
    {
      heading: "The problem",
      items: [
        "Simple modulo hashing (hash(key) % N) reassigns almost every key when N changes",
        "Adding or removing one server can remap 75%+ of all data",
        "This causes massive, unnecessary data movement and load spikes",
      ],
    },
    {
      heading: "The solution — hash ring",
      items: [
        "Arrange both keys and servers on a circular hash space (a \"ring\")",
        "A key belongs to the first server found walking clockwise from its hash",
        "Adding/removing one server only affects the keys in its adjacent arc — a small, bounded fraction",
      ],
    },
    {
      heading: "Virtual nodes",
      items: [
        "Each physical server is placed at many points on the ring, not just one",
        "Spreads a failed server's load evenly across all survivors instead of dumping it on one neighbor",
        "Doesn't fix hot spots by itself — pair with replication or key-space salting for uneven traffic",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — Consistent Hashing", [
    "Simple modulo hashing (hash(key) % N) breaks down the moment N changes: adding a fourth server to a 3-server pool changes the modulo for almost every key, so nearly all data has to move at once — a massive, avoidable spike in load.",
    "Consistent hashing fixes this by arranging both servers and keys on a circular hash space. A key is owned by the first server found walking clockwise from its position on the ring. Adding or removing a server only moves the keys in the small arc adjacent to it — everything else stays exactly where it was.",
    "Virtual nodes spread each physical server across many points on the ring instead of just one, so a failing server's load gets redistributed evenly across every survivor rather than dumped entirely onto its single clockwise neighbor.",
    "Real systems use this to route data, not just databases: Cassandra and DynamoDB use it (or a close variant) for partition placement, and CDNs use it to decide which edge server caches which content.",
  ]);

  editor.zoomToFit();
}
