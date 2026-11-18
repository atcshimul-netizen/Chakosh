import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerResultImageRoutes } from './server/resultImageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 3000;

// Register API routes for temporary result image storage & attachment download
registerResultImageRoutes(app);

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
