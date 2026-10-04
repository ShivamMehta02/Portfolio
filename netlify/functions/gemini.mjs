// Server-side proxy to Google Gemini. The API key never leaves this function.
// Uses GEMINI_API_KEY from Netlify environment variables. If you don't set one,
// Netlify AI Gateway injects GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL automatically.

const MODEL = 'gemini-3-flash-preview';
const MAX_PROMPT_LENGTH = 2000;

const STAGE_NAMES = ['User Query', 'Embedding', 'Retrieval', 'Re-ranking', 'LLM Output'];

const SYSTEM_PROMPT =
  'You are a friendly AI systems mentor embedded in an interactive RAG pipeline demo on a portfolio site. ' +
  'Explain RAG, embeddings, vector retrieval, re-ranking, latency, hallucination and production LLM systems ' +
  'clearly and concisely (under 150 words). Use plain text without markdown formatting.';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) =>
  Response.json(body, { status, headers: CORS_HEADERS });

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Missing GEMINI_API_KEY' }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
  if (!prompt) {
    return json({ error: 'Missing prompt' }, 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` }, 400);
  }

  const stageName = STAGE_NAMES[payload?.stage];
  const systemText = stageName
    ? `${SYSTEM_PROMPT} The user is currently looking at the "${stageName}" stage of the pipeline.`
    : SYSTEM_PROMPT;

  const baseUrl = (process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Gemini API error', response.status, data?.error?.message);
      return json({ error: 'Gemini API request failed' }, 502);
    }

    const answer =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() ||
      'No answer returned';

    return json({ answer });
  } catch (error) {
    console.error('Gemini request error', error);
    return json({ error: 'Failed to reach Gemini API' }, 500);
  }
};
