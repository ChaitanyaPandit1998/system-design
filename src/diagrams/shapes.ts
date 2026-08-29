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

// A requirements panel placed well clear of every diagram (far negative x),
// in the same functional/non-functional-requirements format used across the
// docs in docs/. Returns the shape id so a panel stacked below it (see
// summaryPanel) can be positioned from its *actual* rendered height instead
// of a guessed offset.
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

  const id = createShapeId();
  editor.createShapes([textBlock(id, SIDE_PANEL_X, 60, SIDE_PANEL_W, lines)]);
  return id;
}

// A short prose summary of how the system works end-to-end, stacked below
// `after` (typically the requirementsPanel's shape id) in the same far-left
// column. Reads `after`'s actual page bounds via the editor rather than
// guessing a fixed offset, so it can never overlap regardless of how long
// the panel above it ends up being.
export function summaryPanel(editor: Editor, after: TLShapeId, title: string, paragraphs: string[]) {
  const lines = [title, "", ...paragraphs].join("\n\n");

  const aboveBounds = editor.getShapePageBounds(after);
  const y = (aboveBounds?.maxY ?? 60) + SIDE_PANEL_GAP;

  editor.createShapes([textBlock(createShapeId(), SIDE_PANEL_X, y, SIDE_PANEL_W, lines)]);
}
