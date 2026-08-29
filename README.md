# System Design

Personal notes and diagrams for classic system design interview problems, plus an
interactive [tldraw](https://tldraw.dev) canvas that turns the written architecture
into an editable whiteboard.

## What this is

- **`docs/`** — write-ups for each system (requirements, data model, key trade-offs,
  failure scenarios), one Markdown file per problem, with the reference architecture
  diagram alongside it in `docs/architecture-diagrams/`. Also includes a few
  standalone deep-dive references (`caching.md`, `message-queues.md`,
  `druid-iceberg.md`) not tied to a specific system.
- **`src/`** — a Vite + React app embedding the real tldraw SDK (`src/App.tsx`).
  On first load it seeds one tldraw **page per system**, built programmatically
  from the corresponding doc, so the box-and-arrow diagram and the prose stay in
  sync. Each diagram also gets a Requirements panel (functional / non-functional)
  next to it, in the same format used in the docs. Once loaded, it's a normal
  tldraw board — drag things around, add sticky notes, redraw whatever you like.
  - `src/diagrams/shapes.ts` — shared shape-building helpers (`rect`, `ellipse`,
    `seg` for arrows, `requirementsPanel`)
  - `src/diagrams/<system>.ts` — one file per diagram, each exporting a `VERSION`
    number and a `build(editor)` function
  - `src/diagrams/pages.ts` — seeds/rebuilds every page on mount

Currently covered: **DropBox** (file-sync architecture), **Ticketmaster**
(search/booking/payment, distributed locks, hot-event waiting room), **YouTube**
(upload pipeline, transcoding, streaming via CDN), **Ad Click Aggregator**
(lambda architecture — Kafka/Flink real-time path + Spark reconciliation), and
**Inshorts** (news feed — cache-aside reads, queue-buffered publishing, CDC-synced
search).

## How to use it

```bash
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
- Nothing automatically keeps a diagram in sync with the doc it's built from —
  editing a doc doesn't touch its diagram. Each diagram file records
  `SOURCE_DOC` and `SOURCE_DOC_HASH` (a short hash of the doc's content as of
  the last time the diagram was reviewed); `npm run check-docs`
  (`scripts/check-doc-sync.mjs`) recomputes each doc's current hash and warns
  where it no longer matches. After editing a doc, run it, decide whether the
  diagram still holds up, and update `SOURCE_DOC_HASH` in that diagram's file
  to acknowledge you looked — the script can't know whether a given doc edit
  actually calls for a diagram change, only that one happened.
