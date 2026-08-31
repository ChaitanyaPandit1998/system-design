# System Design

[![CI](https://github.com/ChaitanyaPandit1998/system-design/actions/workflows/ci.yml/badge.svg)](https://github.com/ChaitanyaPandit1998/system-design/actions/workflows/ci.yml)

Personal notes and diagrams for classic system design interview problems, plus an
interactive [tldraw](https://tldraw.dev) canvas that turns the written architecture
into an editable whiteboard.

## What this is

- **`docs/`** — write-ups for each system (requirements, data model, key trade-offs,
  failure scenarios), one Markdown file per problem, with the reference architecture
  diagram alongside it in `docs/architecture-diagrams/`. Also includes a set of
  standalone technology/pattern deep-dives (caching, message queues, Druid &
  Iceberg, CAP theorem, consistent hashing, sharding) that compare tools or
  trade-offs rather than describe one system.
- **`src/`** — a Vite + React app embedding the real tldraw SDK (`src/App.tsx`).
  On first load it seeds one tldraw **page per doc**, built programmatically from
  it, so the box-and-arrow diagram and the prose stay in sync, plus an **Index**
  page as the landing page — a map of every other page, so opening the app
  doesn't mean scrolling a page dropdown blind. The seven single-system pages get
  a Requirements panel (functional / non-functional); the six comparison/
  reference pages get a "Key Concepts" panel instead (per-topic bullet notes —
  requirements framing doesn't fit a technology comparison). Every page also gets
  a "How it works" summary. Once loaded, it's a normal tldraw board — drag things
  around, add sticky notes, redraw whatever you like.
  - `src/diagrams/shapes.ts` — shared shape-building helpers (`rect`, `ellipse`,
    `seg` for arrows, `requirementsPanel`, `notesPanel`, `summaryPanel`,
    `borderedTextPanel`)
  - `src/diagrams/<system>.ts` — one file per diagram, each exporting a `VERSION`
    number and a `build(editor)` function
  - `src/diagrams/index-page.ts` — the landing page; not built from a doc, so it's
    the one page not tracked by `check-docs`
  - `src/diagrams/pages.ts` — seeds/rebuilds every page on mount

Currently covered (see the in-app **Index** page for the same list, grouped):

- **DropBox** — file-sync architecture
- **Ticketmaster** — search/booking/payment, distributed locks, hot-event waiting room
- **YouTube** — upload pipeline, transcoding, streaming via CDN
- **Ad Click Aggregator** — lambda architecture: Kafka/Flink real-time path + Spark reconciliation
- **Inshorts** — news feed: cache-aside reads, queue-buffered publishing, CDC-synced search
- **Distributed Rate Limiter** — API Gateway + sharded Token Bucket in Redis, consistent-hashed, fail-closed
- **Uber** — fare estimation, geospatial driver matching, distributed-locked driver assignment, queued peak-demand handling
- **Caching** — the five cache architectures compared: cache-aside, write-through, write-behind, read-through, write-around
- **Message Queues** — RabbitMQ vs. Kafka vs. SQS, side by side: push vs. pull, exchange+binding vs. partitioned log vs. visibility timeout
- **Druid & Iceberg** — the modern pipeline: Kafka → Flink/Spark → Iceberg (lake) → Druid/Trino (serving)
- **CAP Theorem** — the CP vs. AP choice during a network partition, via the USA/Europe replication example
- **Consistent Hashing** — why modulo hashing breaks on resize, and how the hash ring bounds the damage
- **Sharding** — range-based vs. hash-based vs. directory-based data distribution, side by side

Repo: [github.com/ChaitanyaPandit1998/system-design](https://github.com/ChaitanyaPandit1998/system-design)

## How to use it

```bash
git clone https://github.com/ChaitanyaPandit1998/system-design.git
cd system-design
npm install
npm run dev
```

Open the printed `localhost` URL. Use the page switcher (top-left dropdown) to move
between pages. Everything is editable — it's a real tldraw canvas, not a static
image.

```bash
npm run build    # production build, output in dist/
npm run preview  # serve the production build locally
npm run lint     # ESLint over src/
npm run test     # validate every diagram's generated shapes against tldraw's schema
npm run check-docs  # flag any doc whose diagram hasn't been reviewed since it last changed
```

`lint`, `test`, `check-docs`, and `build` all run in CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
on every push and PR against `main` — see the badge above.

To read the underlying design write-ups without running anything, just open the
files in `docs/` directly — they're plain Markdown with an embedded architecture
screenshot where one exists.

## Notes on how the diagrams are generated

- Each page is built by a `build(editor)` function in `src/diagrams/<system>.ts`
  that calls tldraw's shape API directly (`editor.createShapes`) — real `geo`,
  `arrow`, and `text` shapes, not an image or an SVG.
- Board state persists locally via tldraw's `persistenceKey` (browser storage), so
  edits you make survive a reload.
- Each page carries a `meta.version` number (exported as `VERSION` from that
  diagram's file). A builder only re-runs (wiping and redrawing that page) when
  its version constant is bumped — this is what lets a layout be iterated on
  without permanently overwriting hand edits every time the app reloads. If
  you're editing a board by hand, be aware that bumping a version constant will
  discard those edits on next load.
- To add a new system: write `docs/<name>-system-design.md`, add
  `src/diagrams/<name>.ts` (copy an existing one as a template), and register it
  in `OTHER_PAGES` in `src/diagrams/pages.ts`.
- tldraw shape labels use a `richText` prop (TipTap document), not plain `text` —
  see the `toRichText()` calls in `src/diagrams/shapes.ts` if you're adding new
  shapes by hand.
- `src/diagrams/pages.test.ts` runs every page's `build()` against a fake editor
  and validates the resulting shapes against tldraw's real per-shape-type
  validators (`geoShapeProps`, `arrowShapeProps`, `textShapeProps`) — no DOM or
  full Editor instance needed. This is what would have caught the `richText` vs
  `text` mistake above at test time instead of in the browser; run it (or add a
  case to it) after editing any `build()` function.
- Layout tip learned the hard way: give rows/columns generous gutters (200px+)
  and keep arrow labels short — cramped spacing is what caused most of the
  readability issues fixed along the way.
- `src/diagrams/layout.test.ts` catches that class of issue automatically: it
  runs every page's `build()` and checks whether any arrow's line or estimated
  label footprint overlaps a box it isn't connected to (a cramped label
  crowding a neighboring node, an arrow cutting through an unrelated box). It's
  a heuristic — label size is estimated from character/line counts, not
  measured — so it won't catch everything a human eye would, but it catches
  the exact bug pattern that kept recurring across these diagrams. Run it (or
  extend it) after editing any `build()` function's coordinates.
- Nothing automatically keeps a diagram in sync with the doc it's built from —
  editing a doc doesn't touch its diagram. Each diagram file records
  `SOURCE_DOC` and `SOURCE_DOC_HASH` (a short hash of the doc's content as of
  the last time the diagram was reviewed); `npm run check-docs`
  (`scripts/check-doc-sync.mjs`) recomputes each doc's current hash and warns
  where it no longer matches. After editing a doc, run it, decide whether the
  diagram still holds up, and update `SOURCE_DOC_HASH` in that diagram's file
  to acknowledge you looked — the script can't know whether a given doc edit
  actually calls for a diagram change, only that one happened.
