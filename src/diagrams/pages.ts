import type { Editor, TLPageId } from "tldraw";
import * as adClickAggregator from "./ad-click-aggregator";
import * as caching from "./caching";
import * as capTheorem from "./cap-theorem";
import * as consistentHashing from "./consistent-hashing";
import * as distributedRateLimiter from "./distributed-rate-limiter";
import * as dropbox from "./dropbox";
import * as druidIceberg from "./druid-iceberg";
import * as indexPage from "./index-page";
import * as inshorts from "./inshorts";
import * as messageQueues from "./message-queues";
import * as sharding from "./sharding";
import * as ticketmaster from "./ticketmaster";
import * as uber from "./uber";
import * as youtube from "./youtube";

export interface DiagramPage {
  name: string;
  version: number;
  build: (editor: Editor) => void;
}

// The first page is special-cased in App.tsx (it's renamed from whatever it
// currently is rather than created), everything after that is just created
// by name if missing. It's a navigation map, not built from a doc, so it
// isn't tracked by scripts/check-doc-sync.mjs the way every other page is.
export const FIRST_PAGE: DiagramPage = { name: "Index", version: indexPage.VERSION, build: indexPage.build };

export const OTHER_PAGES: DiagramPage[] = [
  { name: "DropBox", version: dropbox.VERSION, build: dropbox.build },
  { name: "Ticketmaster", version: ticketmaster.VERSION, build: ticketmaster.build },
  { name: "YouTube", version: youtube.VERSION, build: youtube.build },
  { name: "Ad Click Aggregator", version: adClickAggregator.VERSION, build: adClickAggregator.build },
  { name: "Inshorts", version: inshorts.VERSION, build: inshorts.build },
  { name: "Distributed Rate Limiter", version: distributedRateLimiter.VERSION, build: distributedRateLimiter.build },
  { name: "Uber", version: uber.VERSION, build: uber.build },
  { name: "Caching", version: caching.VERSION, build: caching.build },
  { name: "Message Queues", version: messageQueues.VERSION, build: messageQueues.build },
  { name: "Druid & Iceberg", version: druidIceberg.VERSION, build: druidIceberg.build },
  { name: "CAP Theorem", version: capTheorem.VERSION, build: capTheorem.build },
  { name: "Consistent Hashing", version: consistentHashing.VERSION, build: consistentHashing.build },
  { name: "Sharding", version: sharding.VERSION, build: sharding.build },
];

function ensurePage(editor: Editor, pageId: TLPageId, version: number, build: (editor: Editor) => void) {
  editor.setCurrentPage(pageId);
  const meta = editor.getPages().find((p) => p.id === pageId)?.meta as { version?: number } | undefined;

  if (meta?.version !== version) {
    editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
    build(editor);
    editor.updatePage({ id: pageId, meta: { version } });
  }
}

function ensureNamedPage(editor: Editor, page: DiagramPage) {
  let record = editor.getPages().find((p) => p.name === page.name);
  if (!record) {
    editor.createPage({ name: page.name });
    record = editor.getPages().find((p) => p.name === page.name);
  }
  if (record) {
    ensurePage(editor, record.id, page.version, page.build);
  }
}

// Seeds every diagram page on first mount. Idempotent: a page only gets
// wiped and rebuilt when its `version` doesn't match what was last saved.
export function seedAllPages(editor: Editor) {
  const pages = editor.getPages();
  const firstPage = pages[0];

  // Renaming whenever it's not already "Index" (rather than only checking
  // for tldraw's default "Page 1") also migrates anyone whose page[0] was
  // the old first-page convention ("DropBox", before this file added the
  // Index page) — it gets renamed to Index and rebuilt as one, and DropBox
  // reappears fresh via ensureNamedPage below since that name is now free.
  if (firstPage.name !== FIRST_PAGE.name) {
    editor.renamePage(firstPage, FIRST_PAGE.name);
  }
  ensurePage(editor, firstPage.id, FIRST_PAGE.version, FIRST_PAGE.build);

  for (const page of OTHER_PAGES) {
    ensureNamedPage(editor, page);
  }

  editor.setCurrentPage(firstPage.id);
}
