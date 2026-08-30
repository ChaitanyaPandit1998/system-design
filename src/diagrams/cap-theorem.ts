import { createShapeId, type Editor } from "tldraw";
import { ACCENT, notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: CAP Theorem — the CP vs AP choice during a network partition
// (following docs/cap-theorem.md)
//
// The doc's own example (USA/Europe servers, replication breaks, User B's
// read forces a choice) IS the mechanism worth drawing — not the three
// letters C/A/P in the abstract. One shared "what broke" picture, then the
// fork into the two answers, so the reader can see the actual decision
// rather than just the two arrows a Venn diagram would show.

export const VERSION = 1;

export const SOURCE_DOC = "docs/cap-theorem.md";
export const SOURCE_DOC_HASH = "32e9738f659b";

export function build(editor: Editor) {
  const id = () => createShapeId();

  const userA = id();
  const usaServer = id();
  const europeServer = id();
  const userB = id();
  const cpBox = id();
  const apBox = id();

  editor.createShapes([
    rect(userA, 60, 140, 200, 100, "User A"),
    rect(usaServer, 380, 80, 280, 180, "USA Server\n\nname = \"Alexander\"\n(just updated)", {
      verticalAlign: "start",
    }),
    rect(
      europeServer,
      900,
      80,
      280,
      180,
      "Europe Server\n\nname = \"Alex\"\n(stale — replication broken)",
      { verticalAlign: "start" }
    ),
    rect(userB, 1240, 420, 200, 100, "User B"),

    rect(
      cpBox,
      760,
      620,
      340,
      220,
      "Choose Consistency (CP)\n\nReturn an error rather than\nrisk stale data\n\ne.g. ticket booking,\ninventory, financial systems",
      { verticalAlign: "start", color: ACCENT }
    ),
    rect(
      apBox,
      1180,
      620,
      340,
      220,
      "Choose Availability (AP)\n\nReturn the old name —\nstale but available\n\ne.g. social media,\ncontent platforms, review sites",
      { verticalAlign: "start" }
    ),
  ]);

  editor.createShapes([
    seg(id(), 260, 190, 380, 170, { text: "write:\nupdate name", arrowEnd: "arrow" }),
    seg(id(), 660, 170, 900, 170, { text: "✕ replicate\n(partition)", arrowEnd: "arrow", color: ACCENT, dash: "dashed" }),
    seg(id(), 1240, 460, 1040, 260, { text: "read profile", arrowEnd: "arrow" }),

    seg(id(), 990, 260, 930, 620, { arrowEnd: "arrow", color: ACCENT }),
    seg(id(), 1090, 260, 1350, 620, { arrowEnd: "arrow" }),
  ]);

  const notesId = notesPanel(editor, "Key Concepts — CAP Theorem", [
    {
      heading: "The three properties",
      items: [
        "Consistency — all nodes see the same data at the same time",
        "Availability — every request to a non-failing node gets a response",
        "Partition Tolerance — the system keeps working despite network partitions",
      ],
    },
    {
      heading: "The practical reality",
      items: [
        "Partition tolerance is non-negotiable — networks fail",
        "So CAP really boils down to one choice: consistency or availability, during a partition",
        "Ask: would it be catastrophic if users briefly saw inconsistent data?",
      ],
    },
    {
      heading: "Mixed requirements (real systems)",
      items: [
        "Ticketmaster — consistency for booking a seat, availability for browsing events",
        "Tinder — consistency for matching, availability for viewing profiles",
        "Most real systems choose per-feature, not system-wide",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — CAP Theorem", [
    "CAP theorem says a distributed system can only guarantee two of three properties — consistency, availability, partition tolerance — at once. Since networks do fail, partition tolerance isn't really optional, so in practice CAP boils down to a single choice: during a partition, do you prioritize consistency or availability?",
    "Choosing consistency means rejecting a request rather than risk returning stale data — the right call for ticket booking, inventory, and financial systems, where showing two people the same available seat is worse than an error.",
    "Choosing availability means serving the best data you have, even if it's a few seconds or minutes stale — the right call for social media, content platforms, and review sites, where a stale profile picture is a non-issue.",
    "Real systems often make this choice per feature rather than system-wide: Ticketmaster needs strong consistency for booking a seat but can serve stale event descriptions; Tinder needs consistency for matches but can show a slightly outdated profile photo.",
  ]);

  editor.zoomToFit();
}
