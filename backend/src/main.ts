import 'dotenv/config';

import { createServer } from 'node:http';

import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
