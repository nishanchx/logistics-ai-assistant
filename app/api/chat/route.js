/**
 * app/api/chat/route.js
 * ---------------------
 * The RAG endpoint. For every user question:
 *   1. Embed the question (same model used at ingestion time)
 *   2. Retrieve the top-K most similar knowledge-base chunks
 *   3. Ask the chat model to answer USING ONLY that retrieved context
 *   4. Return the answer plus the sources used (for the UI's source tags)
 *
 * Runs as a Vercel serverless function out of the box.
 */

import OpenAI from "openai";
import { topKChunks } from "@/lib/retrieval";
import embeddings from "@/data/embeddings.json";

const CHAT_MODEL = "gpt-4o-mini";
const TOP_K = 5;

const SYSTEM_PROMPT = `You are the internal operations assistant for OTSL, a regional logistics company in Dallas, TX.
You answer questions from dispatchers, drivers, and office staff about shipments, logistics SOPs, and HR/admin policies.

Rules:
- Answer ONLY from the CONTEXT provided below. If the context doesn't contain the answer, say so plainly and suggest who to contact (the contact list may be in context).
- Be concise and operational: lead with the answer, then give steps or details.
- When citing a shipment, always include its ID and current status.
- When a procedure applies (delays, damage, customs holds, cold chain), walk through the SOP steps in order.
- Never invent shipment IDs, ETAs, names, or policies.`;

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Server is missing OPENAI_API_KEY. Add it to .env.local (or Vercel env vars) and redeploy." },
        { status: 500 }
      );
    }

    if (!embeddings.records?.length) {
      return Response.json(
        { error: "Knowledge base is empty. Run `npm run embed` first to generate data/embeddings.json." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { messages } = await request.json();

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage?.content?.trim()) {
      return Response.json({ error: "No question provided." }, { status: 400 });
    }

    // --- 1. Embed the question ------------------------------------------
    const embeddingResponse = await openai.embeddings.create({
      model: embeddings.model,
      input: lastUserMessage.content,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // --- 2. Retrieve relevant chunks ------------------------------------
    const retrieved = topKChunks(queryEmbedding, embeddings.records, TOP_K);
    const context = retrieved
      .map((c, i) => `[${i + 1}] (${c.source} — ${c.title})\n${c.text}`)
      .join("\n\n");

    // --- 3. Generate a grounded answer ----------------------------------
    // Send recent turns so follow-up questions ("what about A127?") work,
    // but ground the latest question in fresh retrieved context.
    const recentHistory = messages.slice(-6, -1).map(({ role, content }) => ({ role, content }));

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recentHistory,
        {
          role: "user",
          content: `CONTEXT:\n${context}\n\nQUESTION: ${lastUserMessage.content}`,
        },
      ],
    });

    // --- 4. Return answer + sources --------------------------------------
    return Response.json({
      answer: completion.choices[0].message.content,
      sources: retrieved.map(({ source, title, score }) => ({
        source,
        title,
        score: Number(score.toFixed(3)),
      })),
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Something went wrong answering that. Check the server logs and try again." },
      { status: 500 }
    );
  }
}
