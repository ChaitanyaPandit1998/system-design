import { createShapeId, type Editor } from "tldraw";
import { ACCENT, rect, requirementsPanel, seg, summaryPanel } from "./shapes";

// Page: Distributed Rate Limiter — API Gateway + sharded Token Bucket
// (following docs/distributed-rate-limiter-system-design.md)
//
// This is a "Design X" problem like Ticketmaster/YouTube (has real
// functional/non-functional requirements), not a comparison doc, so it
// gets the requirements-panel treatment those pages use.

export const VERSION = 2;

export const SOURCE_DOC = "docs/distributed-rate-limiter-system-design.md";
export const SOURCE_DOC_HASH = "3a97097e5594";

export function build(editor: Editor) {
  const id = () => createShapeId();

  const client = id();
  const gateway = id();

  const shard1 = id();
  const shard2 = id();
  const shard3 = id();

  const backend = id();
  const rejected = id();

  editor.createShapes([
    rect(client, 60, 100, 200, 110, "Client"),
    rect(
      gateway,
      460,
      70,
      340,
      190,
      "API Gateway\n\n· identify client (user / IP / API key)\n· Token Bucket algorithm\n· atomic check via Lua script",
      { verticalAlign: "start" }
    ),

    rect(shard1, 600, 500, 220, 190, "Redis Shard 1\n(master + replica)\n\nbuckets: hash range A", {
      verticalAlign: "start",
      color: ACCENT,
    }),
    rect(shard2, 860, 500, 220, 190, "Redis Shard 2\n(master + replica)\n\nbuckets: hash range B", {
      verticalAlign: "start",
      color: ACCENT,
    }),
    rect(shard3, 1120, 500, 220, 190, "Redis Shard 3\n(master + replica)\n\nbuckets: hash range C", {
      verticalAlign: "start",
      color: ACCENT,
    }),

    rect(backend, 100, 920, 300, 150, "Backend\nMicroservices"),
    rect(rejected, 1550, 920, 320, 150, "HTTP 429\nToo Many Requests\n\n+ rate-limit headers"),
  ]);

  editor.createShapes([
    seg(id(), 260, 155, 460, 155, { text: "request", arrowEnd: "arrow" }),

    seg(id(), 700, 260, 970, 500, {
      text: "route via consistent\nhashing(client key)",
      arrowEnd: "arrow",
      color: ACCENT,
    }),

    // pass: routed down the left margin, clear of every shard box
    seg(id(), 550, 260, 550, 360, { arrowEnd: "none" }),
    seg(id(), 550, 360, 250, 360, { arrowEnd: "none" }),
    seg(id(), 250, 360, 250, 920, { text: "pass: forward request", arrowEnd: "arrow" }),

    // fail: routed down the right margin, clear of every shard box
    seg(id(), 790, 260, 790, 360, { arrowEnd: "none" }),
    seg(id(), 790, 360, 1710, 360, { arrowEnd: "none" }),
    seg(id(), 1710, 360, 1710, 920, { text: "fail: reject", arrowEnd: "arrow" }),
  ]);

  const requirementsPanelId = requirementsPanel(
    editor,
    "Requirements — Distributed Rate Limiter",
    [
      "Identify clients by user ID, IP address, or API key",
      "Limit requests based on configurable rules (e.g. 100 req/min/user)",
      "Reject over-limit requests with HTTP 429 and headers (remaining, reset)",
    ],
    [
      "Low latency — under 10ms overhead per request check",
      "High availability — eventual consistency across nodes is acceptable",
      "Scale to 1M requests/second across 100M daily active users",
      "Fail-closed — an outage should reject traffic, not let it flood downstream services",
    ]
  );

  summaryPanel(editor, requirementsPanelId, "How it works — Distributed Rate Limiter", [
    "The rate limiter runs at the API Gateway — the very edge of the system — so blocked traffic never reaches an application server at all. It identifies the client from the request itself (user ID, IP, or API key) and runs a Token Bucket check: each client has a bucket of tokens that refill at a steady rate, and each request consumes one, which naturally handles both sustained load and short bursts.",
    "Bucket state (token count, last refill time) lives in Redis, shared across every gateway instance — otherwise each gateway would only see its own slice of a client's traffic. The read-check-update sequence runs as a single atomic Lua script, since a plain read-then-write still leaves a race window between two concurrent requests for the same client.",
    "A single Redis instance tops out around 50-100K checks/second, well short of the 1M/second target, so bucket state is sharded across roughly 10 Redis instances via consistent hashing on the client key — a given client's requests always land on the same shard, and adding capacity only reshuffles a small fraction of clients.",
    "Each shard is replicated (master + replica) so a single node failure doesn't take it down at all. If a shard is unreachable anyway, the gateway fails closed — rejecting requests rather than letting them through unchecked — because rate-limiter outages tend to coincide with exactly the traffic spikes the limiter exists to protect against.",
  ]);

  editor.zoomToFit();
}
