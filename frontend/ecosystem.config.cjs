module.exports = {
  apps: [{
    name: 'ai-dashboard-builder-frontend',
    cwd: __dirname,
    script: './scripts/preview.mjs',
    env: {
      NODE_ENV: 'production',
      PORT: '5181',
    },
  }],
};
