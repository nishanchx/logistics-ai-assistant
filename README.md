# DispatchDesk — Logistics AI Assistant (RAG)

A Retrieval-Augmented Generation (RAG) chatbot for a logistics company. Ask it things like:

- "Where is shipment A123?"
- "Which shipments are delayed and why?"
- "How do I file a damaged shipment report?"
- "When are timesheets due?"

It answers **only from the company knowledge base** (shipment records, logistics SOPs, HR policies), and shows the source documents it used under every reply.

## How the RAG pipeline works

```
        INGESTION (run once)                     QUERY TIME (every question)
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│ shipments.json              │         │ user question                        │
│ sops.md          ─► chunk   │         │   │ embed (text-embedding-3-small)   │
│ hr_policies.md      each    │         │   ▼                                  │
│                     section │         │ cosine similarity vs all chunks      │
│        │                    │         │   │ top 5 chunks                     │
│        ▼ embed (OpenAI)     │         │   ▼                                  │
│ data/embeddings.json        │ ──────► │ GPT-4o-mini answers using ONLY       │
│ (vector store)              │         │ the retrieved context + cites sources│
└─────────────────────────────┘         └──────────────────────────────────────┘
```

- **Ingestion** — `scripts/build-embeddings.mjs` splits the data into ~25 self-contained chunks (one per shipment, one per SOP/policy section), embeds them with OpenAI's `text-embedding-3-small`, and saves the vectors to `data/embeddings.json`.
- **Retrieval** — `lib/retrieval.js` ranks chunks by cosine similarity to the question's embedding. The dataset is tiny, so an in-memory scan replaces a vector DB (FAISS/Chroma) with zero infrastructure — the same pattern, just simpler.
- **Generation** — `app/api/chat/route.js` sends the top 5 chunks plus the question to `gpt-4o-mini` with a system prompt that forbids answering outside the provided context.

## Tech stack

- **Next.js 14 (App Router)** — UI + serverless API route, deploys natively to Vercel
- **OpenAI API** — embeddings (`text-embedding-3-small`) + chat (`gpt-4o-mini`)
- **No database needed** — embeddings live in a committed JSON file

## Run it locally

**Prerequisites:** Node.js 18+ and an OpenAI API key (platform.openai.com → API keys).

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
# open .env.local and paste your real key:
# OPENAI_API_KEY=sk-...

# 3. Build the knowledge base (embeds the data — costs < $0.01)
npm run embed

# 4. Start the app
npm run dev
```

Open http://localhost:3000 and ask: *"Where is shipment A123?"*

> Re-run `npm run embed` any time you edit the files in `data/`.

**Note for Windows:** `npm run embed` reads `OPENAI_API_KEY` from your environment. The script does not auto-load `.env.local`, so set it in your shell first:
- macOS/Linux: `export OPENAI_API_KEY=sk-...`
- Windows PowerShell: `$env:OPENAI_API_KEY="sk-..."`

(The Next.js app itself *does* auto-load `.env.local` — this only matters for the embed script.)

## Deploy to Vercel

### Option A — GitHub + Vercel dashboard (recommended)

1. **Generate embeddings first** (they must be committed, since Vercel won't have your data pipeline's key at build time):
   ```bash
   npm run embed
   git init
   git add .
   git commit -m "Logistics AI assistant (RAG)"
   ```
2. Push to a new GitHub repo:
   ```bash
   git remote add origin https://github.com/<your-username>/logistics-ai-assistant.git
   git branch -M main
   git push -u origin main
   ```
3. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your repo. Vercel auto-detects Next.js; keep all defaults.
4. Before clicking Deploy, expand **Environment Variables** and add:
   - Name: `OPENAI_API_KEY`
   - Value: your key
5. Click **Deploy**. In ~1 minute you'll have a live URL like `https://logistics-ai-assistant.vercel.app` to put on your resume/LinkedIn.

### Option B — Vercel CLI

```bash
npm i -g vercel
npm run embed                      # make sure embeddings exist
vercel                             # answers a few setup questions
vercel env add OPENAI_API_KEY      # paste your key, select all environments
vercel --prod
```

### Updating the deployed app

Edit data → `npm run embed` → commit → push. Vercel redeploys automatically.

## Project structure

```
├── app/
│   ├── api/chat/route.js    # RAG endpoint: embed → retrieve → generate
│   ├── page.js              # Chat UI
│   ├── layout.js            # Fonts + metadata
│   └── globals.css          # Styles
├── data/
│   ├── shipments.json       # Sample shipment records (structured)
│   ├── sops.md              # Logistics SOPs (unstructured)
│   ├── hr_policies.md       # HR/admin policies (unstructured)
│   └── embeddings.json      # Generated vector store (run `npm run embed`)
├── lib/retrieval.js         # Cosine similarity search
└── scripts/build-embeddings.mjs  # Ingestion pipeline
```

## Good interview talking points

- **Why RAG instead of fine-tuning?** Business data changes daily (shipment statuses). RAG lets you update knowledge by re-embedding a file in seconds, keeps answers grounded and citable, and costs almost nothing.
- **Hallucination control:** the system prompt restricts answers to retrieved context, temperature is low (0.2), and every answer surfaces its sources so users can verify.
- **How would this scale?** Swap the JSON vector store for pgvector/Pinecone/Chroma, ingest directly from the TMS database on a schedule, add metadata filtering (e.g., only search shipments for the asking customer), and add auth.
- **Why these chunks?** One chunk per shipment and per SOP section keeps each chunk self-contained, which makes retrieval precise — chunking strategy matters more than the model.
