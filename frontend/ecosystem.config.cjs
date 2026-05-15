module.exports = {
  apps: [{
    name: 'ai-dashboard-builder-frontend',
    cwd: __dirname,
    script: './scripts/preview.mjs',
    env: {
      NODE_ENV: 'production',
      PORT: '5182',
      VITE_BASE_PATH: '/ai-dashboard-builder/',
    },
  }],
};
