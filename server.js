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

// Dynamic Open Graph handler for Facebook & Messenger crawlers
app.get(['/share.php', '/share', '/koto-boro-chakhor/share.php', '/koto-boro-chakhor/share'], (req, res) => {
  const score = req.query.score || '0';
  const rawTitle = req.query.title || 'খাঁটি চা-খোর';
  const rawDesc = req.query.desc || 'বাঙালির খাঁটি চা-প্রেম পরিমাপের মজার ব্যক্তিত্ব কুইজ। আপনি কত বড় চা-খোর? এখনই টেস্ট করে দেখুন!';
  const id = (req.query.id || '').toString();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const baseUrl = `${protocol}://${host}`;
  const imageUrl = id ? `${baseUrl}/api/image/${id}` : `${baseUrl}/assets/aistudio/1_b616f2b0.jpg`;
  
  const query = new URLSearchParams(req.query);
  query.set('result', '1');
  query.set('auto_popup', '1');
  const redirectUrl = `/?${query.toString()}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>আমি ১০০-তে ${score} পেয়েছি! খেতাব: ${rawTitle}</title>
  <meta property="og:type" content="article">
  <meta property="og:title" content="আমি ১০০-তে ${score} পেয়েছি! খেতাব: ${rawTitle}">
  <meta property="og:description" content="${rawDesc}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1350">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="আমি ১০০-তে ${score} পেয়েছি! খেতাব: ${rawTitle}">
  <meta name="twitter:description" content="${rawDesc}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #FAF7F2; color: #381B0E;">
  <p>ফলাফল প্রস্তুত হচ্ছে...</p>
  <p><a href="${redirectUrl}">এখানে ক্লিক করুন</a></p>
</body>
</html>`);
});

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
