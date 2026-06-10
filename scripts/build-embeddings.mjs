/**
 * build-embeddings.mjs
 * --------------------
 * The "ingestion" half of the RAG pipeline.
 *
 * 1. Reads the knowledge base (shipments.json, sops.md, hr_policies.md)
 * 2. Splits it into small, self-contained text chunks
 * 3. Calls the OpenAI Embeddings API to turn each chunk into a vector
 * 4. Writes everything to data/embeddings.json
 *
 * Run it once before starting the app (and re-run whenever data changes):
 *   OPENAI_API_KEY=sk-... npm run embed
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "embeddings.json");
const EMBEDDING_MODEL = "text-embedding-3-small";

// Load .env.local if present (so `npm run embed` just works)
const envPath = path.join(process.cwd(), ".env.local");
if (!process.env.OPENAI_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Run: OPENAI_API_KEY=sk-... npm run embed");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Turn one shipment record into a readable text chunk. */
function shipmentToText(s) {
  return [
    `Shipment ${s.id} for customer ${s.customer}.`,
    `Route: ${s.origin} -> ${s.destination}.`,
    `Carrier: ${s.carrier}. Contents: ${s.contents}.`,
    `Priority: ${s.priority}. Status: ${s.status}. ETA: ${s.eta}.`,
    `Notes: ${s.notes}`,
  ].join(" ");
}

/** Split a markdown doc into one chunk per "## " section. */
function markdownToChunks(markdown, sourceName) {
  const sections = markdown.split(/\n(?=## )/g);
  return sections
    .map((text) => text.trim())
    .filter((text) => text.length > 40)
    .map((text) => ({
      source: sourceName,
      title: (text.match(/^#+\s*(.+)$/m) || [, sourceName])[1],
      text,
    }));
}

function loadChunks() {
  const chunks = [];

  // 1. Structured shipment data -> one chunk per shipment
  const shipments = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "shipments.json"), "utf8")
  );
  for (const s of shipments) {
    chunks.push({
      source: "Shipment records",
      title: `Shipment ${s.id} — ${s.customer}`,
      text: shipmentToText(s),
    });
  }

  // 2. Unstructured docs -> one chunk per section
  const docs = [
    ["sops.md", "Logistics SOPs"],
    ["hr_policies.md", "HR & Admin policies"],
  ];
  for (const [file, label] of docs) {
    const md = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    chunks.push(...markdownToChunks(md, label));
  }

  return chunks;
}

async function main() {
  const chunks = loadChunks();
  console.log(`Embedding ${chunks.length} chunks with ${EMBEDDING_MODEL}...`);

  // The embeddings endpoint accepts batches — one call for everything.
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks.map((c) => c.text),
  });

  const records = chunks.map((chunk, i) => ({
    ...chunk,
    embedding: response.data[i].embedding,
  }));

  fs.writeFileSync(OUT_FILE, JSON.stringify({ model: EMBEDDING_MODEL, records }));
  console.log(`Wrote ${records.length} embedded chunks to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
