import { preview } from 'vite';

const port = parseInt(process.env.PORT || '5182');
const base = process.env.VITE_BASE_PATH || '/';

const server = await preview({
  base,
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
});

server.printUrls();
