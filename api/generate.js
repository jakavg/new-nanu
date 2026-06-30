// Vercel Serverless Function — memanggil OpenAI di sisi server (sementara).
// API key TIDAK PERNAH dikirim ke browser; dibaca dari env var OPENAI_API_KEY.
const OpenAI = require('openai');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY belum diset di server.' });
    return;
  }

  let prompt = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body && body.prompt;
  } catch (e) {}

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt tidak valid.' });
    return;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content) || '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Gagal menghubungi OpenAI.', detail: String((e && e.message) || e) });
  }
};
