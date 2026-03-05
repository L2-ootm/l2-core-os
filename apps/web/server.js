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
        <h1>L2 Core OS — Config Wizard (MVP)</h1>
        <p>1) Gere token owner 2) Carregue config 3) Aplique override</p>

        <div style="margin-bottom:12px;">
          <button onclick="genToken()">Gerar token owner</button>
          <button onclick="loadConfig()">Carregar config atual</button>
        </div>

        <textarea id="token" rows="3" style="width:100%;" placeholder="Bearer token"></textarea>

        <h3>Override JSON</h3>
        <textarea id="payload" rows="8" style="width:100%;">{"settings":{"MOBILE_SYNC_POLL_SECONDS":30}}</textarea>

        <div style="margin-top:12px;">
          <button onclick="validateCfg()">Validar</button>
          <button onclick="applyCfg()">Aplicar</button>
        </div>

        <pre id="out" style="margin-top:20px;background:#111827;padding:12px;border-radius:8px;"></pre>

        <script>
          const API = 'http://localhost:8000';
          const out = (x)=>document.getElementById('out').textContent = typeof x==='string'?x:JSON.stringify(x,null,2);

          async function genToken(){
            const r = await fetch(API + '/auth/dev-token?role=owner', {method:'POST'});
            const j = await r.json();
            document.getElementById('token').value = j.token || '';
            out(j);
          }

          async function loadConfig(){
            const t = document.getElementById('token').value.trim();
            const r = await fetch(API + '/config/current', {headers:{Authorization:'Bearer '+t}});
            out(await r.json());
          }

          async function validateCfg(){
            const t = document.getElementById('token').value.trim();
            const body = document.getElementById('payload').value;
            const r = await fetch(API + '/config/validate', {method:'POST', headers:{'content-type':'application/json', Authorization:'Bearer '+t}, body});
            out(await r.json());
          }

          async function applyCfg(){
            const t = document.getElementById('token').value.trim();
            const body = document.getElementById('payload').value;
            const r = await fetch(API + '/config/apply', {method:'POST', headers:{'content-type':'application/json', Authorization:'Bearer '+t}, body});
            out(await r.json());
          }
        </script>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`web listening on ${PORT}`);
});
