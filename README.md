# System Design

Personal notes and diagrams for classic system design interview problems, plus an
interactive [tldraw](https://tldraw.dev) canvas that turns the written architecture
into an editable whiteboard.

## What this is

- **`docs/`** — write-ups for each system (requirements, data model, key trade-offs,
  failure scenarios), one Markdown file per problem, with the reference architecture
  diagram alongside it in `docs/architecture-diagrams/`.
- **`src/App.tsx`** — a Vite + React app embedding the real tldraw SDK. On first load
  it seeds one tldraw **page per system**, built programmatically from the
  corresponding doc in `docs/`, so the box-and-arrow diagram and the prose stay in
  sync. Once loaded, it's a normal tldraw board — drag things around, add sticky
  notes, redraw whatever you like.

Currently covered: **DropBox** (file-sync architecture), **Ticketmaster**
(search/booking/payment, distributed locks, hot-event waiting room), **YouTube**
(upload pipeline, transcoding, streaming via CDN).

## How to use it

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Use the page switcher (top-left dropdown) to move
between DropBox / Ticketmaster / YouTube. Everything is editable — it's a real
tldraw canvas, not a static image.

```bash
npm run build    # production build, output in dist/
npm run preview  # serve the production build locally
```

To read the underlying design write-ups without running anything, just open the
files in `docs/` directly — they're plain Markdown with an embedded architecture
screenshot.

## Notes on how the diagrams are generated

- Each page is built by a `build*Diagram(editor)` function in `src/App.tsx` that
  calls tldraw's shape API directly (`editor.createShapes`) — real `geo` and
  `arrow` shapes, not an image or an SVG.
- Board state persists locally via tldraw's `persistenceKey` (browser storage), so
  edits you make survive a reload.
- Each page carries a `meta.version` number. A builder only re-runs (wiping and
  redrawing that page) when its version constant in `App.tsx` is bumped — this is
  what lets the layout be iterated on without permanently overwriting hand edits
  every time the app reloads. If you're editing a board by hand, be aware that
  bumping a version constant will discard those edits on next load.
- tldraw shape labels use a `richText` prop (TipTap document), not plain `text` —
  see the `toRichText()` calls in the shape helpers if you're adding new shapes by
  hand.
