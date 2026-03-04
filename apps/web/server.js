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
        <h1>L2 Core OS</h1>
        <p>Status: bootstrap ativo</p>
        <ul>
          <li>API: <a href="http://localhost:8000/health">/health</a></li>
          <li>Baileys Gateway: <a href="http://localhost:8090/health">/health</a></li>
        </ul>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`web listening on ${PORT}`);
});
