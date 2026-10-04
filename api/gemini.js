export default async function handler(req, res) {
  const allowedOrigin = '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, stage } = req.body || {};
    const text = typeof prompt === 'string' ? prompt.trim() : '';

    if (!text) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const stageContext = typeof stage === 'number'
      ? `The user is currently exploring the "${stage + 1}" stage of the pipeline.`
      : 'The user is exploring the AI pipeline demo.';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${text}\n\nContext: ${stageContext}\nAnswer as an expert AI systems engineer. Keep the answer concise, technical, and polished. Explain trade-offs and practical production concerns when relevant.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 320
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({
        error: 'Gemini request failed',
        detail: errText
      });
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join('')
      .trim();

    return res.status(200).json({
      answer: answer || 'No answer generated.'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
}
