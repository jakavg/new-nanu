// Vercel Serverless Function — memanggil Claude di sisi server.
// API key TIDAK PERNAH dikirim ke browser; dibaca dari env var ANTHROPIC_API_KEY.
const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY belum diset di server.' });
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
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Gagal menghubungi Claude.', detail: String((e && e.message) || e) });
  }
};
