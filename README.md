# DispatchDesk - Internal Logistics AI Agent
 
DispatchDesk is an AI agent built to help logistics employees quickly find information from shipment records, company procedures, and HR documents.
 
Instead of running one fixed retrieval pipeline, the agent looks at each question and decides which tools it needs. Exact shipment questions go to a direct data lookup, filtering questions go to a query tool, and policy questions go through semantic search. The agent can also chain multiple tools together to complete a task.
 
## Example Questions
 
- Where is shipment A123?
- Which shipments are currently delayed?
- How do I file a damaged shipment report?
- Draft the customer delay email for A124 following our SOP.
## Features
 
- AI agent that picks the right tool for each question
- Exact lookups for shipment data instead of fuzzy search
- Semantic (RAG) search across SOPs and HR documents
- Multi-step tasks by chaining tools, like fetching a shipment and the matching SOP to draft an email
- Agent steps displayed under every answer so users can see how it got there
- Simple architecture with no external database required
## How It Works
 
1. The user asks a question.
2. The model sees a list of available tools and decides which ones to call.
3. Tools are executed and results are sent back to the model.
4. The loop repeats until the model has enough information to answer (max 5 rounds).
5. The answer is returned along with a trace of every tool call.
## Available Tools
 
- `get_shipment(id)` - looks up one shipment by exact ID in the structured data
- `list_shipments(status, priority)` - filters shipments, used for questions like "which shipments are delayed"
- `search_policies(query)` - semantic search over SOPs and HR policies using OpenAI embeddings and cosine similarity
## Tech Stack
 
- Next.js 14
- JavaScript
- OpenAI API (function calling, embeddings, GPT-4o-mini)
- Vercel
- Vector Embeddings
- Cosine Similarity Search
## Running Locally
 
Install dependencies:
 
```
npm install
```
 
Create a local environment file:
 
```
cp .env.example .env.local
```
 
Add your OpenAI API key:
 
```
OPENAI_API_KEY=your_api_key
```
 
Generate embeddings:
 
```
npm run embed
```
 
Start the development server:
 
```
npm run dev
```
 
Open http://localhost:3000 in your browser.
 
## Project Structure
 
```
app/
├── api/chat/route.js    # agent loop
├── page.js
├── layout.js
 
data/
├── shipments.json
├── sops.md
├── hr_policies.md
├── embeddings.json
 
lib/
├── tools.js             # tool definitions and implementations
└── retrieval.js         # cosine similarity search
 
scripts/
└── build-embeddings.mjs
```
 
## Design Decisions
 
**Why an agent instead of plain RAG?**
Similarity search works well for documents but poorly for structured data. Asking "what is the ETA of A124" through embeddings depends on fuzzy matching, while a direct lookup is always exact. Letting the model choose between structured lookups and semantic search gives accurate answers for both types of questions.
 
**Why RAG for the documents?**
Company procedures change frequently. Retrieval allows the assistant to work with updated information without retraining a model, and keeps answers grounded in real sources.
 
**Why a JSON vector store?**
The dataset for this project is small, so storing embeddings in a JSON file keeps the architecture simple and avoids additional infrastructure.
 
**How is hallucination handled?**
The system prompt instructs the model to only answer from tool results and never invent shipment IDs, ETAs, or policies. The visible tool trace makes it easy to verify where each answer came from.
 
## Challenges
 
- Designing the tool boundaries between structured and unstructured data
- Keeping tool result payloads small so the context window stays manageable
- Handling cases where the agent loops without reaching an answer
- Making the agent's steps visible to users in a clear way
