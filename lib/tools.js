/**
 * lib/tools.js
 * ------------
 * Tools the agent can call. This is the upgrade from "plain RAG" to "agent":
 * instead of always running one fixed retrieve-then-answer pipeline, the LLM
 * looks at the question and DECIDES which tools it needs, possibly chaining
 * several calls before answering.
 *
 *  - get_shipment / list_shipments -> exact lookups against structured data
 *    (no embeddings involved, so IDs, ETAs and statuses are always precise)
 *  - search_policies -> semantic (RAG) search over the SOP + HR documents
 */

import shipments from "@/data/shipments.json";
import embeddings from "@/data/embeddings.json";
import { topKChunks } from "@/lib/retrieval";

/** Tool schemas the model sees (OpenAI function-calling format). */
export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_shipment",
      description:
        "Look up one shipment by its exact ID. Returns full details: status, ETA, route, carrier, priority, notes.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Shipment ID, e.g. 'A123'" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_shipments",
      description:
        "List shipments, optionally filtered by status and/or priority. Use this for questions like 'which shipments are delayed' or 'show urgent deliveries'.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Filter by status (case-insensitive substring match), e.g. 'delayed', 'in transit', 'delivered', 'exception'.",
          },
          priority: {
            type: "string",
            description: "Filter by priority, e.g. 'URGENT', 'High', 'Standard'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_policies",
      description:
        "Semantic search over company documents: logistics SOPs (delays, damage reports, customs, cold chain, secure deliveries) and HR/admin policies (timesheets, PTO, onboarding, expenses, contacts). Use whenever a question involves a procedure, rule, or policy.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" },
        },
        required: ["query"],
      },
    },
  },
];

/** Run a tool by name and return a JSON-serializable result. */
export async function executeTool(name, args, openai) {
  switch (name) {
    case "get_shipment": {
      const shipment = shipments.find(
        (s) => s.id.toLowerCase() === String(args.id || "").trim().toLowerCase()
      );
      return shipment || { error: `No shipment found with ID '${args.id}'.` };
    }

    case "list_shipments": {
      let results = shipments;
      if (args.status) {
        const q = args.status.toLowerCase();
        results = results.filter((s) => s.status.toLowerCase().includes(q));
      }
      if (args.priority) {
        const q = args.priority.toLowerCase();
        results = results.filter((s) => s.priority.toLowerCase().includes(q));
      }
      // Keep the payload small: summaries only. The model can call
      // get_shipment for full details on anything interesting.
      return results.map(({ id, customer, status, priority, eta, notes }) => ({
        id,
        customer,
        status,
        priority,
        eta,
        notes,
      }));
    }

    case "search_policies": {
      // Classic RAG, scoped to the document chunks (shipments are served
      // precisely by the structured tools above).
      const policyRecords = embeddings.records.filter(
        (r) => r.source !== "Shipment records"
      );
      const embeddingResponse = await openai.embeddings.create({
        model: embeddings.model,
        input: args.query,
      });
      const top = topKChunks(embeddingResponse.data[0].embedding, policyRecords, 4);
      return top.map(({ source, title, text }) => ({ source, title, text }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
