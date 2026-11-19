import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { registerResultImageRoutes } from './server/resultImageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 3000;

// Register API routes for temporary result image storage & attachment download
registerResultImageRoutes(app);

// Helper to bridge analytics requests to PHP CLI during local Node development
function handlePhpAnalytics(req, res) {
  const phpScript = path.join(__dirname, 'public', 'api', 'analytics.php');
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
  const env = {
    ...process.env,
    REQUEST_METHOD: req.method,
    QUERY_STRING: queryString,
    CONTENT_TYPE: req.headers['content-type'] || 'application/json',
    HTTP_USER_AGENT: req.headers['user-agent'] || '',
    HTTP_AUTHORIZATION: req.headers['authorization'] || '',
  };

  const php = spawn('php', [phpScript], { env });
  req.pipe(php.stdin);

  let stdout = '';
  let stderr = '';
  php.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  php.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  php.on('close', () => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (stdout) {
      res.send(stdout);
    } else {
      res.status(500).json({ error: stderr || 'PHP bridge error' });
    }
  });

  php.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
}

// Analytics endpoints for both root and base paths
app.all(['/api/analytics', '/api/analytics.php', '/koto-boro-chakhor/api/analytics', '/koto-boro-chakhor/api/analytics.php'], handlePhpAnalytics);

// Serve built static assets at both the configured Vite base path and root
app.use('/koto-boro-chakhor', express.static(distDir));
app.use(express.static(distDir));

// SPA fallback for client routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});
