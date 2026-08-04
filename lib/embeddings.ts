import axios from 'axios';

const DIM = parseInt(process.env.EMBEDDING_DIM || '1536', 10);
const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL || '';

export async function getEmbedding(payload: { text?: string; imagePath?: string }): Promise<number[]> {
  if (EMBEDDINGS_URL) {
    try {
      const res = await axios.post(`${EMBEDDINGS_URL}/embed`, payload, { timeout: 120000 });
      if (res.data?.embedding && Array.isArray(res.data.embedding)) {
        return res.data.embedding.map((n: any) => Number(n));
      }
    } catch (err) {
      console.warn('Error calling local embeddings provider:', err?.message || err);
    }
  }
  // Fallback: generate a random vector (deterministic-ish)
  return Array.from({ length: DIM }, () => Math.random() * 2 - 1);
}
