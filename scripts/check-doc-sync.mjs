#!/usr/bin/env node
// Flags when a doc in docs/ has changed since its tldraw diagram in
// src/diagrams/ was last built from it. Nothing enforces that link beyond
// convention — a diagram's build() function doesn't know its doc changed —
// so this makes the drift visible instead of silent.
//
// Each diagram file records SOURCE_DOC (the doc it's built from) and
// SOURCE_DOC_HASH (a short hash of that doc's content at the time the
// diagram was last updated). This script recomputes the doc's current hash
// and compares. It does not, and can't, know whether the diagram *should*
// change for a given doc edit (e.g. a typo fix vs. a new component) — it
// only flags "these are out of sync," and updating SOURCE_DOC_HASH is a
// deliberate acknowledgement that you looked at the diagram and decided
// whether it needs a matching update.
//
// Run manually: npm run check-docs

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  { name: "DropBox", diagram: "src/diagrams/dropbox.ts" },
  { name: "Ticketmaster", diagram: "src/diagrams/ticketmaster.ts" },
  { name: "YouTube", diagram: "src/diagrams/youtube.ts" },
  { name: "Ad Click Aggregator", diagram: "src/diagrams/ad-click-aggregator.ts" },
  { name: "Inshorts", diagram: "src/diagrams/inshorts.ts" },
  { name: "Druid & Iceberg", diagram: "src/diagrams/druid-iceberg.ts" },
  { name: "Message Queues", diagram: "src/diagrams/message-queues.ts" },
  { name: "Caching", diagram: "src/diagrams/caching.ts" },
  { name: "CAP Theorem", diagram: "src/diagrams/cap-theorem.ts" },
  { name: "Consistent Hashing", diagram: "src/diagrams/consistent-hashing.ts" },
  { name: "Sharding", diagram: "src/diagrams/sharding.ts" },
  { name: "Distributed Rate Limiter", diagram: "src/diagrams/distributed-rate-limiter.ts" },
  { name: "Uber", diagram: "src/diagrams/uber.ts" },
];

function hashOf(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

let hasDrift = false;

for (const page of PAGES) {
  const diagramPath = path.join(root, page.diagram);
  const diagramSource = readFileSync(diagramPath, "utf8");

  const docMatch = diagramSource.match(/SOURCE_DOC\s*=\s*"([^"]+)"/);
  const hashMatch = diagramSource.match(/SOURCE_DOC_HASH\s*=\s*"([0-9a-f]+)"/);

  if (!docMatch || !hashMatch) {
    console.error(`✗ ${page.name}: ${page.diagram} is missing SOURCE_DOC / SOURCE_DOC_HASH`);
    hasDrift = true;
    continue;
  }

  const docRelPath = docMatch[1];
  const recordedHash = hashMatch[1];
  const docContent = readFileSync(path.join(root, docRelPath), "utf8");
  const currentHash = hashOf(docContent);

  if (currentHash !== recordedHash) {
    console.warn(
      `⚠ ${page.name}: ${docRelPath} changed since ${page.diagram} was last reviewed ` +
        `(recorded "${recordedHash}", now "${currentHash}"). Check whether the diagram ` +
        `still matches, then update SOURCE_DOC_HASH in ${page.diagram}.`
    );
    hasDrift = true;
  } else {
    console.log(`✓ ${page.name}: diagram matches ${docRelPath}`);
  }
}

if (hasDrift) {
  process.exitCode = 1;
}
