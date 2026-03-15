import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const port = Number(process.env.PORT || 4173);
const distDir = resolve(process.cwd(), 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const resolvePath = (urlPath) => {
  if (!urlPath || urlPath === '/') {
    return join(distDir, 'index.html');
  }
  return join(distDir, decodeURIComponent(urlPath));
};

createServer(async (request, response) => {
  const requestPath = resolvePath(request.url);
  const extension = extname(requestPath);

  try {
    const data = await readFile(requestPath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    });
    response.end(data);
    return;
  } catch (error) {
    if (extension) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
  }

  try {
    const data = await readFile(join(distDir, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(data);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Build output not found. Run "npm run build" first.');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Statement Atlas listening on http://0.0.0.0:${port}`);
});
