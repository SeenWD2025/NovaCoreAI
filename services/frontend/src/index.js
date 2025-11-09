import express from 'express';

const app = express();
const PORT = process.env.PORT || 5173;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'frontend', note: 'Phase 10 - Coming Soon' });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Noble NovaCoreAI</title></head>
      <body style="font-family: system-ui; padding: 2rem; max-width: 800px; margin: 0 auto;">
        <h1>🚀 Noble NovaCoreAI</h1>
        <p><strong>Frontend Application - Phase 10</strong></p>
        <p>The React frontend will be implemented in Phase 10.</p>
        <hr/>
        <p>Current Status: Foundation Complete ✅</p>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚛️  Frontend stub running on port ${PORT} (Phase 10 - Coming Soon)`);
});
