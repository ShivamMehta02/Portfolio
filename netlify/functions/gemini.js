const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const prompt = (payload.prompt || '').trim();

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing prompt' })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY environment variable' })
      };
    }

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: `You are an AI Systems Engineer and product storyteller. Explain AI, RAG, embeddings, retrieval, re-ranking, and LLM systems in a concise, polished, technical but friendly way. Keep answers to 2-4 sentences unless the user explicitly asks for more detail. Use clear examples and explain practical production trade-offs. The user is looking at a portfolio demo and wants content that feels premium, clever, and technically credible.`
          }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 300
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Gemini request failed',
          details: errorText
        })
      };
    }

    const result = await response.json();
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join('')
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: answer || 'No answer generated.'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
