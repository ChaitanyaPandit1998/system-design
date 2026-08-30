import { describe, expect, it } from "vitest";
import type { Editor } from "tldraw";
import { FIRST_PAGE, OTHER_PAGES } from "./pages";

// Geometric readability check for every diagram: catches an arrow's label
// (or its line) overlapping a box it isn't connected to — the exact bug
// class that showed up twice already (a cramped label crowding a
// neighboring node, an arrow cutting straight through an unrelated shard
// box). This is a heuristic, not pixel-perfect: label size is *estimated*
// from character/line counts, not measured. It runs against the same
// headless fake editor as pages.test.ts, no DOM needed.

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface RecordedShape {
  id: string;
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
}

function createFakeEditor() {
  const shapes: RecordedShape[] = [];
  const editor = {
    createShapes(partials: RecordedShape[]) {
      shapes.push(...partials);
    },
    zoomToFit() {},
    getShapePageBounds() {
      return { maxY: 500 };
    },
  };
  return { editor: editor as unknown as Editor, shapes };
}

// Matches toRichText()'s output shape: { type: 'doc', content: [{ type:
// 'paragraph', content?: [{ type: 'text', text }] }, ...] }, one paragraph
// per original line.
function plainTextFromRichText(richText: unknown): string {
  const doc = richText as { content?: { content?: { text?: string }[] }[] };
  if (!doc?.content) return "";
  return doc.content.map((para) => para.content?.map((n) => n.text ?? "").join("") ?? "").join("\n");
}

function rectOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function pointInRect(x: number, y: number, r: Rect, margin = 0): boolean {
  return x > r.minX + margin && x < r.maxX - margin && y > r.minY + margin && y < r.maxY - margin;
}

const CHAR_W = 8; // generous estimate for tldraw's "draw" font at size s/m
const LINE_H = 24;

describe("diagram layout", () => {
  const pages = [FIRST_PAGE, ...OTHER_PAGES];

  it.each(pages.map((page) => [page.name, page] as const))("%s has no label/box collisions", (_name, page) => {
    const { editor, shapes } = createFakeEditor();
    page.build(editor);

    // Empty-label geo shapes (e.g. a container outline, the consistent-hashing
    // ring) are backdrops other content is *meant* to sit inside/near — they
    // aren't a collision risk the way an actual labeled box is, so exclude
    // them rather than flag every arrow that passes near one.
    const boxes: (Rect & { label: string })[] = shapes
      .filter((s) => s.type === "geo")
      .map((s) => {
        const w = s.props.w as number;
        const h = s.props.h as number;
        return {
          minX: s.x,
          minY: s.y,
          maxX: s.x + w,
          maxY: s.y + h,
          label: plainTextFromRichText(s.props.richText).slice(0, 30),
        };
      })
      .filter((b) => b.label.trim() !== "");

    const arrows = shapes.filter((s) => s.type === "arrow");
    const problems: string[] = [];

    for (const arrow of arrows) {
      const start = { x: arrow.x, y: arrow.y };
      const end = arrow.props.end as { x: number; y: number };
      const endAbs = { x: arrow.x + end.x, y: arrow.y + end.y };
      const text = plainTextFromRichText(arrow.props.richText);

      // boxes this arrow is allowed to touch — whichever box(es) its
      // start/end points land in, since connecting to your own endpoint is
      // expected, not a collision
      const connected = boxes.filter(
        (b) => pointInRect(start.x, start.y, b, -4) || pointInRect(endAbs.x, endAbs.y, b, -4)
      );

      // 1) does the line itself cut through an unrelated box?
      for (let t = 0.08; t <= 0.92; t += 0.04) {
        const px = start.x + t * (endAbs.x - start.x);
        const py = start.y + t * (endAbs.y - start.y);
        for (const box of boxes) {
          if (connected.includes(box)) continue;
          if (pointInRect(px, py, box, 6)) {
            problems.push(`arrow "${text.slice(0, 24) || "(unlabeled)"}" line crosses box "${box.label}"`);
            break;
          }
        }
      }

      // 2) does the label overlap a box it isn't connected to?
      if (!text) continue;
      const lines = text.split("\n");
      const lineCount = lines.length;
      const maxLen = Math.max(...lines.map((l) => l.length));
      const labelW = maxLen * CHAR_W;
      const labelH = lineCount * LINE_H;
      const midX = (start.x + endAbs.x) / 2;
      const midY = (start.y + endAbs.y) / 2;
      const labelRect: Rect = {
        minX: midX - labelW / 2,
        maxX: midX + labelW / 2,
        minY: midY - labelH / 2,
        maxY: midY + labelH / 2,
      };

      for (const box of boxes) {
        if (connected.includes(box)) continue;
        if (rectOverlap(labelRect, box)) {
          problems.push(`arrow label "${text.slice(0, 24)}" overlaps box "${box.label}"`);
        }
      }
    }

    // de-duplicate (the line-sampling loop can flag the same box repeatedly)
    const unique = [...new Set(problems)];
    expect(unique, unique.join("\n")).toEqual([]);
  });
});
