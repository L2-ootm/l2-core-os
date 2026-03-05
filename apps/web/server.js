import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '../../infra/.env' });

const app = express();
const PORT = process.env.WEB_PORT || 3000;

app.get('/', (_req, res) => {
  res.send(`
    <html>
      <head><title>L2 Core OS</title></head>
      <body style="background:#0b0f19;color:#dce3f1;font-family:Arial;padding:24px;">
        <h1>L2 Core OS — Dashboard Operacional</h1>
        <p>Configurações + WhatsApp + IA em blocos + Classificação de leads</p>

        <h3>Autenticação</h3>
        <button onclick="genToken()">Gerar token owner</button>
        <textarea id="token" rows="3" style="width:100%;margin-top:8px" placeholder="Bearer token"></textarea>

        <h3>Configurações do Sistema</h3>
        <button onclick="loadConfig()">Carregar config</button>
        <textarea id="payload" rows="5" style="width:100%;margin-top:8px">{"settings":{"MOBILE_SYNC_POLL_SECONDS":30}}</textarea>
        <div style="margin-top:8px">
          <button onclick="validateCfg()">Validar</button>
          <button onclick="applyCfg()">Aplicar</button>
        </div>

        <h3>WhatsApp (intra app)</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="waStatus()">Status</button>
          <button onclick="waQr()">Ver QR</button>
          <button onclick="waConnect()">Conectar</button>
          <button onclick="waCatchup()">Catch-up agora</button>
          <button onclick="waDisconnect(false)">Desconectar</button>
          <button onclick="waDisconnect(true)">Trocar número (reset auth)</button>
        </div>

        <h3>Leads e Classificações</h3>
        <button onclick="loadClassifications()">Atualizar classificações</button>

        <h3>IA por blocos (sem chat livre)</h3>
        <textarea id="aiText" rows="3" style="width:100%;">confirmo presença</textarea>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="runBlock('confirm')">Confirmar</button>
          <button onclick="runBlock('cancel')">Cancelar</button>
          <button onclick="runBlock('reschedule')">Remarcar</button>
          <button onclick="runBlock('triage')">Triagem</button>
        </div>

        <h3>Saída</h3>
        <pre id="out" style="margin-top:10px;background:#111827;padding:12px;border-radius:8px;white-space:pre-wrap"></pre>

        <script>
          const API = 'http://localhost:8000';
          const WA = 'http://localhost:8090';
          const out = (x)=>document.getElementById('out').textContent = typeof x==='string'?x:JSON.stringify(x,null,2);
          const tk = ()=>document.getElementById('token').value.trim();

          async function genToken(){ const r=await fetch(API+'/auth/dev-token?role=owner',{method:'POST'}); const j=await r.json(); document.getElementById('token').value=j.token||''; out(j); }
          async function loadConfig(){ const r=await fetch(API+'/config/current',{headers:{Authorization:'Bearer '+tk()}}); out(await r.json()); }
          async function validateCfg(){ const b=document.getElementById('payload').value; const r=await fetch(API+'/config/validate',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+tk()},body:b}); out(await r.json()); }
          async function applyCfg(){ const b=document.getElementById('payload').value; const r=await fetch(API+'/config/apply',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+tk()},body:b}); out(await r.json()); }

          async function waStatus(){ const r=await fetch(WA+'/session/status'); out(await r.json()); }
          async function waQr(){ const r=await fetch(WA+'/session/qr'); out(await r.json()); }
          async function waConnect(){ const r=await fetch(WA+'/session/connect',{method:'POST'}); out(await r.json()); }
          async function waCatchup(){ const r=await fetch(WA+'/session/catchup',{method:'POST'}); out(await r.json()); }
          async function waDisconnect(clearAuth){ const r=await fetch(WA+'/session/disconnect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clearAuth})}); out(await r.json()); }

          async function loadClassifications(){ const r=await fetch(API+'/ops/leads/classifications',{headers:{Authorization:'Bearer '+tk()}}); out(await r.json()); }
          async function runBlock(action){ const text=document.getElementById('aiText').value; const r=await fetch(API+'/ai/block-action',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+tk()},body:JSON.stringify({action,text,source:'dashboard'})}); out(await r.json()); }
        </script>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`web listening on ${PORT}`);
});
