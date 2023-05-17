import express from 'express';
import next from 'next';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  // Serve static files from the public directory
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/app', (req, res) => {
    return nextApp.render(req, res, '/app', req.query);
  });

  // Move the /auth route definition here
  app.get('/auth', (req, res) => {
    // Replace res.render() with res.sendFile() to send the HTML file directly
    res.sendFile(path.join(__dirname, 'public/auth.html'));
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(3001, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3001');
  });
});
