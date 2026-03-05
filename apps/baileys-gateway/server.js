import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import crypto from 'crypto';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';

// Em container, env_file injeta variáveis. Em dev local, tenta carregar infra/.env.
dotenv.config();
dotenv.config({ path: '../../infra/.env' });

const app = express();
app.use(express.json());

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.BAILEYS_PORT || 8090);
const API_BASE = process.env.API_BASE_URL || 'http://api:8000';
const TOKEN = process.env.BAILEYS_INTERNAL_TOKEN || 'change_internal_token';
const WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || 'change_this_secret';
const SESSION_NAME = process.env.BAILEYS_SESSION_NAME || 'main';
const STARTUP_CATCHUP_HOURS = Number(process.env.STARTUP_CATCHUP_HOURS || 24);

let sock = null;
let isConnecting = false;
let reconnectAttempts = 0;
let lastQr = null;
let lastStatus = 'idle';
let lastDisconnectReason = null;
const processedInboundIds = new Set();
const processedOutboundKeys = new Set();
let lastCatchupAt = null;
let lastCatchupRecovered = 0;

function normalizeText(text = '') {
  return String(text).trim();
}

function parseTimestamp(messageTimestamp) {
  try {
    if (messageTimestamp == null) return new Date().toISOString();
    const n = Number(messageTimestamp);
    if (!Number.isNaN(n) && Number.isFinite(n)) return new Date(n * 1000).toISOString();
    if (typeof messageTimestamp?.toString === 'function') {
      const nn = Number(messageTimestamp.toString());
      if (!Number.isNaN(nn) && Number.isFinite(nn)) return new Date(nn * 1000).toISOString();
    }
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function rememberWithCap(setObj, value, cap = 5000) {
  setObj.add(value);
  if (setObj.size > cap) {
    const first = setObj.values().next().value;
    if (first) setObj.delete(first);
  }
}

async function forwardInbound(msg) {
  const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const phone = (msg.key?.remoteJid || '').replace('@s.whatsapp.net', '');
  if (!phone || !msg.key?.id) return;
  if (processedInboundIds.has(msg.key.id)) return;

  const payload = {
    external_message_id: msg.key.id,
    phone: phone.startsWith('+') ? phone : `+${phone}`,
    text: normalizeText(textMsg),
    timestamp: parseTimestamp(msg.messageTimestamp),
    raw: msg,
  };

  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', WEBHOOK_HMAC_SECRET).update(`${ts}.${body}`).digest('hex');

  await axios.post(`${API_BASE}/webhooks/whatsapp/inbound`, body, {
    headers: {
      'x-internal-token': TOKEN,
      'x-webhook-timestamp': ts,
      'x-webhook-signature': signature,
      'content-type': 'application/json',
    },
    timeout: 15000,
  });

  rememberWithCap(processedInboundIds, msg.key.id);
}

function scheduleReconnect() {
  reconnectAttempts += 1;
  const waitMs = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
  logger.warn({ reconnectAttempts, waitMs }, 'Scheduling reconnect');
  setTimeout(() => {
    connectWhatsApp().catch((err) => logger.error({ err }, 'Reconnect failed'));
  }, waitMs);
}

async function runStartupCatchup() {
  if (!sock) return;
  const recoveredBefore = processedInboundIds.size;
  const oldestMs = Date.now() - (STARTUP_CATCHUP_HOURS * 60 * 60 * 1000);

  try {
    const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
    const chatIds = Object.keys(chats || {});
    for (const jid of chatIds.slice(0, 20)) {
      try {
        const msg = await sock.fetchMessageHistory(20, undefined, jid).catch(() => null);
        if (!msg) continue;
      } catch {}
    }

    // Fallback de catch-up: marca timestamp da tentativa; recuperação real vem por "append" e buffer da sessão.
    lastCatchupAt = new Date().toISOString();
    lastCatchupRecovered = Math.max(0, processedInboundIds.size - recoveredBefore);
    logger.info({ lastCatchupAt, recovered: lastCatchupRecovered, windowHours: STARTUP_CATCHUP_HOURS, oldestMs }, 'Startup catch-up executed');
  } catch (err) {
    logger.warn({ err }, 'Startup catch-up failed (non-blocking)');
  }
}

async function connectWhatsApp(force = false) {
  if (isConnecting) return;
  if (sock && !force) return;

  isConnecting = true;
  lastStatus = 'connecting';

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./.auth/${SESSION_NAME}`);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      auth: state,
      browser: Browsers.ubuntu('L2 Core OS'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 15000,
      connectTimeoutMs: 30000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        lastQr = qr;
        lastStatus = 'qr_ready';
        qrcode.generate(qr, { small: true });
        logger.info('QR generated - scan with WhatsApp');
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        lastDisconnectReason = null;
        lastStatus = 'connected';
        logger.info('WhatsApp connected');
        runStartupCatchup().catch((err) => logger.warn({ err }, 'Startup catch-up error'));
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        lastDisconnectReason = code || 'unknown';
        lastStatus = 'disconnected';

        const loggedOut = code === DisconnectReason.loggedOut;
        if (loggedOut) {
          logger.warn('WhatsApp session logged out; reconnect requires new QR');
          sock = null;
          return;
        }

        sock = null;
        scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const m of messages) {
        if (m.key?.fromMe) continue;
        try {
          await forwardInbound(m);
        } catch (err) {
          logger.error({ err }, 'Failed to forward inbound message');
        }
      }
    });
  } catch (err) {
    lastStatus = 'error';
    logger.error({ err }, 'connectWhatsApp failed');
    sock = null;
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'baileys-gateway',
    status: lastStatus,
    reconnect_attempts: reconnectAttempts,
  });
});

app.get('/session/status', (_req, res) => {
  res.json({
    ok: true,
    status: lastStatus,
    has_qr: !!lastQr,
    reconnect_attempts: reconnectAttempts,
    last_disconnect_reason: lastDisconnectReason,
    processed_inbound_ids: processedInboundIds.size,
    processed_outbound_keys: processedOutboundKeys.size,
    last_catchup_at: lastCatchupAt,
    last_catchup_recovered: lastCatchupRecovered,
    startup_catchup_hours: STARTUP_CATCHUP_HOURS,
  });
});

app.get('/session/qr', (_req, res) => {
  if (!lastQr) return res.status(404).json({ ok: false, error: 'qr_not_available' });
  res.json({ ok: true, qr: lastQr });
});

app.post('/session/connect', async (_req, res) => {
  connectWhatsApp(true).catch((err) => logger.error({ err }, 'manual connect failed'));
  res.json({ ok: true, started: true });
});

app.post('/simulate/inbound', async (req, res) => {
  try {
    const payload = req.body;
    const body = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', WEBHOOK_HMAC_SECRET).update(`${ts}.${body}`).digest('hex');

    const r = await axios.post(`${API_BASE}/webhooks/whatsapp/inbound`, body, {
      headers: {
        'x-internal-token': TOKEN,
        'x-webhook-timestamp': ts,
        'x-webhook-signature': signature,
        'content-type': 'application/json',
      },
    });
    res.json({ ok: true, forwarded: true, api_response: r.data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/outbound/send', async (req, res) => {
  const { idempotency_key, phone, message } = req.body || {};
  if (!idempotency_key || !phone || !message) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  if (processedOutboundKeys.has(idempotency_key)) {
    return res.json({ ok: true, deduplicated: true, provider: 'baileys', idempotency_key });
  }
  if (!sock || lastStatus !== 'connected') {
    return res.status(503).json({ ok: false, error: 'whatsapp_not_connected' });
  }

  const jid = `${String(phone).replace('+', '').replace(/\D/g, '')}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text: String(message) });
    rememberWithCap(processedOutboundKeys, idempotency_key);
    return res.json({ ok: true, sent: true, provider: 'baileys', idempotency_key });
  } catch (err) {
    logger.error({ err }, 'Failed outbound send');
    return res.status(500).json({ ok: false, error: 'send_failed' });
  }
});

app.listen(PORT, async () => {
  logger.info(`baileys-gateway listening on ${PORT}`);
  await connectWhatsApp();
});
