# DispatchDesk - Internal Logistics Assistant

DispatchDesk is a retrieval-augmented generation (RAG) chatbot built to help logistics employees quickly find information from shipment records, company procedures, and HR documents.

Instead of relying on a language model's training data, the assistant searches internal company documents and uses the most relevant information to answer questions.

## Example Questions

* Where is shipment A123?
* Which shipments are currently delayed?
* How do I file a damaged shipment report?
* When are timesheets due?

## Features

* Natural language search across logistics documents
* Retrieval of relevant company information before generating responses
* Source citations displayed with every answer
* Shipment tracking data stored in JSON format
* Logistics SOPs and HR policies stored as markdown documents
* Simple architecture with no external database required

## How It Works

1. Documents are split into smaller chunks.
2. OpenAI embeddings are generated for each chunk.
3. User questions are converted into embeddings.
4. Cosine similarity is used to find the most relevant content.
5. The retrieved context is sent to the language model to generate a response.

## Tech Stack

* Next.js 14
* JavaScript
* OpenAI API
* Vercel
* Vector Embeddings
* Cosine Similarity Search

## Running Locally

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your OpenAI API key:

```env
OPENAI_API_KEY=your_api_key
```

Generate embeddings:

```bash
npm run embed
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Project Structure

```text
app/
├── api/chat/route.js
├── page.js
├── layout.js

data/
├── shipments.json
├── sops.md
├── hr_policies.md
├── embeddings.json

lib/
└── retrieval.js

scripts/
└── build-embeddings.mjs
```

## Design Decisions

### Why RAG?

Shipment information and company procedures can change frequently. Using retrieval allows the assistant to work with updated information without retraining a model.

### Why a JSON Vector Store?

The dataset for this project is small, so storing embeddings in a JSON file keeps the architecture simple and avoids additional infrastructure.

### Challenges

* Designing chunking strategies for structured and unstructured data
* Improving retrieval quality for shipment-related questions
* Managing context size while preserving relevant information
* Ensuring answers reference the correct source documents

## Future Improvements

* Add user authentication
* Connect to a real transportation management system
* Replace JSON storage with a vector database
* Add document upload capabilities
* Support conversation history

## Author

Nishan Chaulagain

Computer Science Student | AI and Software Development
