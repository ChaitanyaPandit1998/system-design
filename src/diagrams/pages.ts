import type { Editor, TLPageId } from "tldraw";
import * as adClickAggregator from "./ad-click-aggregator";
import * as dropbox from "./dropbox";
import * as druidIceberg from "./druid-iceberg";
import * as inshorts from "./inshorts";
import * as messageQueues from "./message-queues";
import * as ticketmaster from "./ticketmaster";
import * as youtube from "./youtube";

export interface DiagramPage {
  name: string;
  version: number;
  build: (editor: Editor) => void;
}

// The first page is special-cased in App.tsx (it's renamed from tldraw's
// default "Page 1" rather than created), everything after that is just
// created by name if missing.
export const FIRST_PAGE: DiagramPage = { name: "DropBox", version: dropbox.VERSION, build: dropbox.build };

export const OTHER_PAGES: DiagramPage[] = [
  { name: "Ticketmaster", version: ticketmaster.VERSION, build: ticketmaster.build },
  { name: "YouTube", version: youtube.VERSION, build: youtube.build },
  { name: "Ad Click Aggregator", version: adClickAggregator.VERSION, build: adClickAggregator.build },
  { name: "Inshorts", version: inshorts.VERSION, build: inshorts.build },
  { name: "Druid & Iceberg", version: druidIceberg.VERSION, build: druidIceberg.build },
  { name: "Message Queues", version: messageQueues.VERSION, build: messageQueues.build },
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

  if (firstPage.name === "Page 1") {
    editor.renamePage(firstPage, FIRST_PAGE.name);
  }
  ensurePage(editor, firstPage.id, FIRST_PAGE.version, FIRST_PAGE.build);

  for (const page of OTHER_PAGES) {
    ensureNamedPage(editor, page);
  }

  editor.setCurrentPage(firstPage.id);
}
