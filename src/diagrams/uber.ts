import { createShapeId, type Editor } from "tldraw";
import { ACCENT, ellipse, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: Uber (Ride-Sharing Service) — fare estimation, matching, driver accept
// (following docs/uber-system-design.md)
//
// This is a "Design X" problem like Ticketmaster/YouTube/the rate limiter
// (real functional/non-functional requirements), so it gets the
// requirements-panel treatment. Two arrows (driver location pings, and the
// push notification back to a matched driver) are routed as elbows through
// open corridors rather than straight diagonals, since a direct line for
// either would cut through the services row in between — same fix applied
// to the rate limiter and CAP theorem pages after the last readability pass.

export const VERSION = 1;

export const SOURCE_DOC = "docs/uber-system-design.md";
export const SOURCE_DOC_HASH = "e3f9d31c0768";

export function build(editor: Editor) {
  const id = () => createShapeId();

  const riderClient = id();
  const driverClient = id();
  const gateway = id();

  const rideService = id();
  const rideMatchingService = id();
  const notificationService = id();

  const mappingApi = id();
  const db = id();
  const locationService = id();

  editor.createShapes([
    rect(riderClient, 60, 100, 220, 110, "Rider Client"),
    rect(driverClient, 60, 300, 220, 110, "Driver Client"),
    rect(gateway, 460, 70, 300, 170, "API Gateway\n\n· auth\n· rate limit\n· route", {
      verticalAlign: "start",
    }),

    rect(
      rideService,
      460,
      480,
      280,
      170,
      "Ride Service\n\n· fare estimation\n· create Fare/Ride\n· trigger matching",
      { verticalAlign: "start" }
    ),
    rect(
      rideMatchingService,
      900,
      480,
      280,
      170,
      "Ride Matching\nService\n\nfinds nearby,\navailable drivers",
      { verticalAlign: "start" }
    ),
    rect(
      notificationService,
      1340,
      480,
      280,
      170,
      "Notification\nService\n\nAPNs / FCM push\nto matched driver",
      { verticalAlign: "start" }
    ),

    ellipse(mappingApi, 460, 900, 260, 200, "3rd-Party\nMapping API"),
    ellipse(db, 800, 900, 280, 220, "DB\n\nFare, Ride,\nRider, Driver"),
    rect(
      locationService,
      1180,
      900,
      300,
      200,
      "Location Service\n\nRedis geospatial store —\ndriver pings + nearby queries",
      { verticalAlign: "start", color: ACCENT }
    ),
  ]);

  editor.createShapes([
    seg(id(), 280, 155, 460, 155, { text: "POST /fare,\nPOST /rides", arrowEnd: "arrow" }),
    seg(id(), 280, 355, 460, 200, { text: "PATCH /rides/:id", arrowEnd: "arrow" }),
    seg(id(), 600, 240, 600, 480, { text: "route", arrowEnd: "arrow" }),

    seg(id(), 550, 650, 590, 900, {
      text: "distance / ETA",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),
    seg(id(), 650, 650, 900, 900, {
      text: "create / read\nFare, Ride",
      arrowStart: "arrow",
      arrowEnd: "arrow",
    }),
    seg(id(), 740, 565, 900, 565, { text: "trigger matching", arrowEnd: "arrow" }),

    seg(id(), 1480, 565, 1340, 565, { text: "notify matched\ndriver", arrowEnd: "arrow" }),
    seg(id(), 1040, 650, 1280, 900, {
      text: "get nearby\ndrivers",
      arrowEnd: "arrow",
      color: ACCENT,
    }),

    // driver location pings: gateway -> right margin -> down -> into Location Service,
    // routed around the services row instead of a diagonal through it
    seg(id(), 760, 150, 1720, 150, { arrowEnd: "none", color: ACCENT }),
    seg(id(), 1720, 150, 1720, 950, {
      text: "updateLocation()\n(driver pings)",
      arrowEnd: "none",
      color: ACCENT,
    }),
    seg(id(), 1720, 950, 1480, 950, { arrowEnd: "arrow", color: ACCENT }),

    // push notification back to the driver: up from Notification Service,
    // left through the open corridor above the services row
    seg(id(), 1480, 480, 1480, 380, { arrowEnd: "none", dash: "dashed" }),
    seg(id(), 1480, 380, 280, 380, {
      text: "push: new ride\nrequest available",
      arrowEnd: "arrow",
      dash: "dashed",
    }),
  ]);

  const requirementsPanelId = requirementsPanel(
    editor,
    "Requirements — Uber",
    [
      "Get a fare estimate from a start location and destination",
      "Request a ride based on the estimated fare",
      "Match the rider with a nearby, available driver",
      "Driver accepts/declines and navigates to pickup/drop-off",
    ],
    [
      "Low latency matching — under 1 minute to match, or a clear failure",
      "Strong consistency — no driver is ever assigned two rides at once",
      "High throughput — handle surges (e.g. 100K requests from one location)",
    ]
  );

  summaryPanel(editor, requirementsPanelId, "How it works — Uber", [
    "A rider gets a fare estimate first: the Ride Service calls a third-party mapping API for distance/time, prices it, and stores a Fare record — separate from Ride, since an estimate can exist before a ride is ever confirmed.",
    "Requesting a ride creates a Ride record and triggers the Ride Matching Service, which queries the Location Service for nearby, available drivers and picks the best match. Driver locations live in an in-memory geospatial store (not a general-purpose DB) because ~10M drivers pinging every few seconds is millions of writes/second, and lat/long doesn't index well in a plain B-tree anyway.",
    "The matched driver gets a push notification (APNs/FCM) — an out-of-band path outside the request/response cycle. To prevent two requests from locking the same driver, the driver is held under a distributed lock with a TTL: released the moment they accept or decline, or auto-expired if they don't respond, at which point the request moves to the next driver on the ranked list.",
    "During demand spikes, requests are absorbed by a queue with dynamic scaling on the consumer side rather than processed synchronously — so a burst doesn't drop rides, and a Ride Matching Service crash doesn't lose in-flight requests either.",
  ]);

  editor.zoomToFit();
}
