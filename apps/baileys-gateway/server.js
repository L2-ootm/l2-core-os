import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '../../infra/.env' });

const app = express();
app.use(express.json());

const PORT = process.env.BAILEYS_PORT || 8090;
const API_BASE = process.env.API_BASE_URL || 'http://api:8000';
const TOKEN = process.env.BAILEYS_INTERNAL_TOKEN || 'change_internal_token';

// Placeholder de integração Baileys real.
// Nesta fase, endpoint de simulação para validar fluxo inbound/outbound.

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'baileys-gateway' });
});

app.post('/simulate/inbound', async (req, res) => {
  try {
    const payload = req.body;
    const r = await axios.post(`${API_BASE}/webhooks/whatsapp/inbound`, payload, {
      headers: {
        'x-internal-token': TOKEN,
        'content-type': 'application/json'
      }
    });
    res.json({ ok: true, forwarded: true, api_response: r.data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/outbound/send', async (req, res) => {
  // TODO: conectar envio real via Baileys
  const { idempotency_key, phone, message } = req.body || {};
  if (!idempotency_key || !phone || !message) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  return res.json({ ok: true, queued: true, provider: 'baileys', idempotency_key });
});

app.listen(PORT, () => {
  console.log(`baileys-gateway listening on ${PORT}`);
});
