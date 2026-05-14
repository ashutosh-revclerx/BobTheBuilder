import { preview } from 'vite';

const port = parseInt(process.env.PORT || '5182');

const server = await preview({
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
});

server.printUrls();
