import { createShapeId, toRichText, type Editor, type TLShapeId } from "tldraw";

export const BLACK = "black" as const;
export const ACCENT = "violet" as const;

export function rect(
  id: TLShapeId,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: {
    align?: "start" | "middle" | "end";
    verticalAlign?: "start" | "middle" | "end";
    color?: typeof BLACK | typeof ACCENT;
    size?: "s" | "m";
  }
) {
  return {
    id,
    type: "geo" as const,
    x,
    y,
    props: {
      w,
      h,
      geo: "rectangle" as const,
      richText: toRichText(text),
      color: opts?.color ?? BLACK,
      fill: "none" as const,
      size: opts?.size ?? "s",
      font: "draw" as const,
      align: opts?.align ?? "middle",
      verticalAlign: opts?.verticalAlign ?? "middle",
    },
  };
}

export function ellipse(id: TLShapeId, x: number, y: number, w: number, h: number, text: string) {
  return {
    id,
    type: "geo" as const,
    x,
    y,
    props: {
      w,
      h,
      geo: "ellipse" as const,
      richText: toRichText(text),
      color: BLACK,
      fill: "none" as const,
      size: "s" as const,
      font: "draw" as const,
      align: "middle" as const,
      verticalAlign: "middle" as const,
    },
  };
}

export function seg(
  id: TLShapeId,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts?: {
    text?: string;
    arrowStart?: "none" | "arrow";
    arrowEnd?: "none" | "arrow";
    color?: typeof BLACK | typeof ACCENT;
    dash?: "draw" | "solid" | "dashed" | "dotted";
  }
) {
  return {
    id,
    type: "arrow" as const,
    x: x1,
    y: y1,
    props: {
      start: { x: 0, y: 0 },
      end: { x: x2 - x1, y: y2 - y1 },
      arrowheadStart: opts?.arrowStart ?? "none",
      arrowheadEnd: opts?.arrowEnd ?? "arrow",
      richText: toRichText(opts?.text ?? ""),
      color: opts?.color ?? BLACK,
      dash: opts?.dash ?? "draw",
      size: "s" as const,
      font: "draw" as const,
      bend: 0,
    },
  };
}

export function textBlock(id: TLShapeId, x: number, y: number, w: number, text: string) {
  return {
    id,
    type: "text" as const,
    x,
    y,
    props: {
      w,
      richText: toRichText(text),
      color: BLACK,
      size: "m" as const,
      font: "draw" as const,
      textAlign: "start" as const,
      autoSize: false,
      scale: 1,
    },
  };
}

const SIDE_PANEL_X = -900;
const SIDE_PANEL_W = 700;
const SIDE_PANEL_GAP = 80; // vertical gap between stacked side panels
const SIDE_PANEL_PADDING = 32; // border inset around the text inside a panel

// A block of text with a border drawn around its actual rendered size (read
// back via getShapePageBounds after creating the text), so the panel reads
// as a distinct card instead of floating text. The border has no fill, so
// it never needs to be z-ordered behind the text. Returns the border
// shape's id — used to position whatever panel is stacked below it.
function borderedTextPanel(editor: Editor, x: number, y: number, w: number, text: string): TLShapeId {
  const textId = createShapeId();
  editor.createShapes([textBlock(textId, x, y, w, text)]);

  const bounds = editor.getShapePageBounds(textId);
  const pad = SIDE_PANEL_PADDING;
  const borderId = createShapeId();
  editor.createShapes([
    rect(
      borderId,
      (bounds?.minX ?? x) - pad,
      (bounds?.minY ?? y) - pad,
      (bounds?.width ?? w) + pad * 2,
      (bounds?.height ?? 0) + pad * 2,
      "",
      { size: "m" }
    ),
  ]);

  return borderId;
}

// A requirements panel placed well clear of every diagram (far negative x),
// in the same functional/non-functional-requirements format used across the
// docs in docs/. Returns the border shape's id so a panel stacked below it
// (see summaryPanel) can be positioned from its *actual* rendered height
// instead of a guessed offset.
export function requirementsPanel(
  editor: Editor,
  title: string,
  functional: string[],
  nonFunctional: string[]
): TLShapeId {
  const lines = [
    title,
    "",
    "Functional Requirements",
    ...functional.map((line) => `· ${line}`),
    "",
    "Non-Functional Requirements",
    ...nonFunctional.map((line) => `· ${line}`),
  ].join("\n");

  return borderedTextPanel(editor, SIDE_PANEL_X, 60, SIDE_PANEL_W, lines);
}

// A generic sectioned notes panel — same bordered-card treatment as
// requirementsPanel, but for reference/deep-dive pages where "functional /
// non-functional requirements" framing doesn't fit (there's no single
// system with users to gather requirements from). Each section gets a
// heading line followed by its bullet items.
export function notesPanel(
  editor: Editor,
  title: string,
  sections: { heading: string; items: string[] }[]
): TLShapeId {
  const lines = [
    title,
    "",
    ...sections.flatMap((section) => [section.heading, ...section.items.map((line) => `· ${line}`), ""]),
  ]
    .join("\n")
    .trimEnd();

  return borderedTextPanel(editor, SIDE_PANEL_X, 60, SIDE_PANEL_W, lines);
}

// A short prose summary of how the system works end-to-end, stacked below
// `after` (typically the requirementsPanel's returned id) in the same
// far-left column. Reads `after`'s actual page bounds via the editor rather
// than guessing a fixed offset, so it can never overlap regardless of how
// long the panel above it ends up being.
export function summaryPanel(editor: Editor, after: TLShapeId, title: string, paragraphs: string[]) {
  const lines = [title, "", ...paragraphs].join("\n\n");

  const aboveBounds = editor.getShapePageBounds(after);
  const y = (aboveBounds?.maxY ?? 60) + SIDE_PANEL_GAP;

  borderedTextPanel(editor, SIDE_PANEL_X, y, SIDE_PANEL_W, lines);
}
