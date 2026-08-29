import { arrowShapeProps, geoShapeProps, textShapeProps, type Editor } from "tldraw";
import { describe, expect, it } from "vitest";
import { FIRST_PAGE, OTHER_PAGES } from "./pages";

// Regression test for the exact bug class that bit us once already: a shape
// helper passing an excess or wrong-shaped prop (e.g. `text` instead of
// `richText`) compiles fine — the helper functions return inferred object
// types, so TypeScript's excess-property check never fires — but throws a
// tldraw ValidationError at runtime, in the browser, well after the fact.
//
// This runs every diagram's build() against a fake editor that just records
// the shapes it's asked to create, then validates each shape's props against
// tldraw's *real* per-shape-type validators (the same ones the actual
// tldraw Store uses), without needing a full Editor/DOM/canvas.

const PROPS_VALIDATORS: Record<string, Record<string, { validate(value: unknown): unknown }>> = {
  geo: geoShapeProps,
  arrow: arrowShapeProps,
  text: textShapeProps,
};

function validateShapeProps(type: string, props: Record<string, unknown>) {
  const validators = PROPS_VALIDATORS[type];
  if (!validators) {
    throw new Error(`No known prop validator for shape type "${type}" — add one to PROPS_VALIDATORS`);
  }

  for (const key of Object.keys(props)) {
    if (!(key in validators)) {
      throw new Error(`Unexpected prop "${key}" on a "${type}" shape`);
    }
  }

  for (const [key, validator] of Object.entries(validators)) {
    if (key in props) {
      validator.validate(props[key]);
    }
  }
}

interface RecordedShape {
  type: string;
  props: Record<string, unknown>;
}

function createFakeEditor() {
  const shapes: RecordedShape[] = [];
  const editor = {
    createShapes(partials: RecordedShape[]) {
      shapes.push(...partials);
    },
    zoomToFit() {
      // no-op — no viewport in this headless harness
    },
    getShapePageBounds() {
      // summaryPanel only reads `.maxY`; the exact value doesn't matter here
      return { maxY: 500 };
    },
  };
  return { editor: editor as unknown as Editor, shapes };
}

describe("diagram builders", () => {
  const pages = [FIRST_PAGE, ...OTHER_PAGES];

  it.each(pages.map((page) => [page.name, page] as const))("%s produces only valid tldraw shapes", (_name, page) => {
    const { editor, shapes } = createFakeEditor();

    expect(() => page.build(editor)).not.toThrow();
    expect(shapes.length).toBeGreaterThan(0);

    for (const shape of shapes) {
      expect(() => validateShapeProps(shape.type, shape.props)).not.toThrow();
    }
  });
});
