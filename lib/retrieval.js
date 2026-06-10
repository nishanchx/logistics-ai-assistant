/**
 * lib/retrieval.js
 * ----------------
 * The "retrieval" half of the RAG pipeline.
 * Given a query vector, find the most relevant knowledge-base chunks
 * by cosine similarity. The dataset is small (~25 chunks), so a simple
 * in-memory scan is faster and simpler than running a vector database.
 */

export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {number[]} queryEmbedding - embedding of the user's question
 * @param {Array} records - embedded chunks from data/embeddings.json
 * @param {number} topK - how many chunks to return
 */
export function topKChunks(queryEmbedding, records, topK = 5) {
  return records
    .map((record) => ({
      ...record,
      score: cosineSimilarity(queryEmbedding, record.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
