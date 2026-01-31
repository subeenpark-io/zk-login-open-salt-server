module.exports = {
  apps: [{
    name: 'zklogin-wallet',
    script: 'dist-server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      SALT_SERVER_URL: 'http://zklogin-prod-alb-1474010946.ap-northeast-2.elb.amazonaws.com',
      PROVER_URL: 'https://prover-dev.mystenlabs.com'
    }
  }]
};
