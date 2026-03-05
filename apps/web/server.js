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
        <h1>L2 Core OS — Config + AI Blocks Wizard (MVP)</h1>
        <p>Token -> Config -> IA em blocos funcionais (sem chat livre)</p>

        <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="genToken()">Gerar token owner</button>
          <button onclick="loadConfig()">Carregar config atual</button>
          <button onclick="aiPolicy()">Ver política IA</button>
        </div>

        <textarea id="token" rows="3" style="width:100%;" placeholder="Bearer token"></textarea>

        <h3>Override JSON</h3>
        <textarea id="payload" rows="6" style="width:100%;">{"settings":{"MOBILE_SYNC_POLL_SECONDS":30}}</textarea>

        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="validateCfg()">Validar</button>
          <button onclick="applyCfg()">Aplicar</button>
        </div>

        <h3 style="margin-top:18px;">IA por blocos (ações fechadas)</h3>
        <textarea id="aiText" rows="3" style="width:100%;" placeholder="Texto do paciente">confirmo presença</textarea>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="runBlock('confirm')">Confirmar</button>
          <button onclick="runBlock('cancel')">Cancelar</button>
          <button onclick="runBlock('reschedule')">Remarcar</button>
          <button onclick="runBlock('triage')">Triagem Humana</button>
        </div>

        <pre id="out" style="margin-top:20px;background:#111827;padding:12px;border-radius:8px;white-space:pre-wrap"></pre>

        <script>
          const API = 'http://localhost:8000';
          const out = (x)=>document.getElementById('out').textContent = typeof x==='string'?x:JSON.stringify(x,null,2);
          const getToken = ()=>document.getElementById('token').value.trim();

          async function genToken(){
            const r = await fetch(API + '/auth/dev-token?role=owner', {method:'POST'});
            const j = await r.json();
            document.getElementById('token').value = j.token || '';
            out(j);
          }

          async function loadConfig(){
            const r = await fetch(API + '/config/current', {headers:{Authorization:'Bearer '+getToken()}});
            out(await r.json());
          }

          async function validateCfg(){
            const body = document.getElementById('payload').value;
            const r = await fetch(API + '/config/validate', {method:'POST', headers:{'content-type':'application/json', Authorization:'Bearer '+getToken()}, body});
            out(await r.json());
          }

          async function applyCfg(){
            const body = document.getElementById('payload').value;
            const r = await fetch(API + '/config/apply', {method:'POST', headers:{'content-type':'application/json', Authorization:'Bearer '+getToken()}, body});
            out(await r.json());
          }

          async function aiPolicy(){
            const r = await fetch(API + '/ai/capability/policy', {headers:{Authorization:'Bearer '+getToken()}});
            out(await r.json());
          }

          async function runBlock(action){
            const text = document.getElementById('aiText').value;
            const body = JSON.stringify({ action, text, source:'wizard' });
            const r = await fetch(API + '/ai/block-action', {method:'POST', headers:{'content-type':'application/json', Authorization:'Bearer '+getToken()}, body});
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
