import { createApp } from './app.mjs';
const app = await createApp();
let vite;
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true, hmr: { server: app.server } }, appType: 'spa' });
  app.setMiddleware(vite.middlewares);
}
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
app.server.listen(port, host, () => console.log(`Realm is ready at http://localhost:${port}\nLAN: http://<this-computer-ip>:${port}`));
async function shutdown() { await vite?.close(); await app.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
