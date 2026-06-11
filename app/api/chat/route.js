/**
 * app/api/chat/route.js
 * ---------------------
 * Agentic endpoint. Instead of one fixed RAG pipeline, the model runs in a
 * tool-calling loop:
 *
 *   1. Model sees the question + available tools
 *   2. If it needs data, it requests tool calls (get_shipment,
 *      list_shipments, search_policies) — possibly several, possibly chained
 *   3. We execute them and feed results back
 *   4. Loop until the model produces a final answer (max 5 rounds)
 *
 * The response includes a `trace` of every tool call so the UI can show
 * the agent's reasoning steps.
 */

import OpenAI from "openai";
import embeddings from "@/data/embeddings.json";
import { toolDefinitions, executeTool } from "@/lib/tools";

const CHAT_MODEL = "gpt-4o-mini";
const MAX_AGENT_ROUNDS = 5;

const SYSTEM_PROMPT = `You are the internal operations agent for DispatchDesk Logistics, a regional logistics company in Dallas, TX.
You help dispatchers, drivers, and office staff with shipments, logistics SOPs, and HR/admin policies.

You have tools. Use them — never answer about shipments or policies from memory:
- Exact shipment questions -> get_shipment
- "Which shipments are X" questions -> list_shipments
- Any procedure, rule, or policy -> search_policies
- Multi-part tasks (e.g. "draft the delay notice for A124 per our SOP") -> chain tools: fetch the shipment, fetch the SOP, then do the task.

Rules:
- Ground every claim in tool results. If the tools don't return the answer, say so and point to the right contact (search_policies can find the contact list).
- Be concise and operational: lead with the answer, then steps or details.
- Always include shipment IDs and current status when discussing shipments.
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

    const history = (messages || [])
      .filter((m) => m.content?.trim())
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    if (!history.length || history[history.length - 1].role !== "user") {
      return Response.json({ error: "No question provided." }, { status: 400 });
    }

    const conversation = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
    const trace = [];

    // ---- The agent loop ----------------------------------------------------
    for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.2,
        messages: conversation,
        tools: toolDefinitions,
      });

      const message = completion.choices[0].message;

      // No tool calls -> the model is done; this is the final answer.
      if (!message.tool_calls?.length) {
        return Response.json({ answer: message.content, trace });
      }

      // Otherwise: execute every requested tool and feed results back.
      conversation.push(message);
      for (const call of message.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* leave args empty; the tool will report the problem */
        }

        trace.push({ tool: call.function.name, args });
        const result = await executeTool(call.function.name, args, openai);

        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Safety net: force a final answer if the loop hit the round limit.
    const fallback = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        ...conversation,
        { role: "user", content: "Answer now using the information gathered above." },
      ],
    });
    return Response.json({ answer: fallback.choices[0].message.content, trace });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Something went wrong answering that. Check the server logs and try again." },
      { status: 500 }
    );
  }
}
