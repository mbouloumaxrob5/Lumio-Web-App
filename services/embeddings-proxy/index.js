const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'text-embedding-3-small';
const DIM = parseInt(process.env.EMBEDDING_DIM || '1536', 10);

function deterministicVectorFromSeed(seed, dim) {
  // Create a deterministic vector in [-1,1] from a seed string
  const hash = crypto.createHash('sha256').update(seed).digest();
  const vec = new Array(dim);
  // Expand hash bytes into floats
  for (let i = 0; i < dim; i++) {
    // Use hash cycles
    const byte = hash[i % hash.length];
    // Create a fractional value between 0 and 1
    const frac = byte / 255;
    vec[i] = frac * 2 - 1; // map to [-1,1]
  }
  return vec;
}

app.post('/embed', async (req, res) => {
  try {
    const { text, imagePath, imageBase64 } = req.body || {};
    const seed = String(text || imagePath || imageBase64 || Math.random());

    // If OpenAI key is provided, call OpenAI embeddings endpoint
    if (OPENAI_API_KEY) {
      try {
        const input = text || seed;
        const response = await axios.post('https://api.openai.com/v1/embeddings', {
          model: OPENAI_MODEL,
          input
        }, {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        });

        const embedding = response.data?.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) {
          // Ensure length matches DIM; if different, pad/truncate
          let vec = embedding.map((n) => Number(n));
          if (vec.length < DIM) {
            // pad with deterministic values
            const pad = deterministicVectorFromSeed(seed + ':pad', DIM - vec.length);
            vec = vec.concat(pad);
          } else if (vec.length > DIM) {
            vec = vec.slice(0, DIM);
          }
          return res.json({ embedding: vec });
        }

      } catch (err) {
        console.warn('OpenAI embeddings error, falling back to deterministic vector', err?.message || err);
      }
    }

    // Fallback deterministic vector
    const vec = deterministicVectorFromSeed(seed, DIM);
    return res.json({ embedding: vec });
  } catch (err) {
    console.error('Embed endpoint error', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/', (req, res) => res.json({ ok: true, message: 'Local embeddings proxy. POST /embed with { text, imagePath, imageBase64 }' }));

app.listen(PORT, () => {
  console.log(`Embeddings proxy listening on http://localhost:${PORT} (DIM=${DIM})`);
});
