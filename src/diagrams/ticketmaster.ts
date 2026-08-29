import { createShapeId, type Editor } from "tldraw";
import { ACCENT, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: Ticketmaster — search/booking/payment, locks, waiting room, CDC
// (following docs/ticketmaster-system-design.md)
//
// Laid out in three well-separated rows (edge -> services -> stores) with
// wide gutters so arrow labels never have to share space with a box or
// another label.

export const VERSION = 6;

export function build(editor: Editor) {
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

  const requirementsPanelId = requirementsPanel(
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

  summaryPanel(editor, requirementsPanelId, "How it works — Ticketmaster", [
    "Users search events served out of Elasticsearch, and book seats through the Booking Service, which acquires a short-TTL Redis lock (SETNX, 10 minutes) on that specific seat so two people can't buy it at once.",
    "Popular on-sale events are gated by a virtual waiting room before traffic even reaches the booking flow, smoothing the spike and issuing access tokens in order.",
    "Booking calls the Payment Service to charge via Stripe; once the webhook confirms sold/failed, the booking status updates and the Redis lock is released (or it auto-expires on TTL if payment never completes).",
    "A CDC pipeline (Debezium + Kafka) streams changes from PostgreSQL — the source of truth — into Elasticsearch, so search results stay consistent with the booking state without coupling the write path to the search index.",
  ]);

  editor.zoomToFit();
}
