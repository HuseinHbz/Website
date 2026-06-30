module.exports = {
  apps: [
    {
      name: 'habibazar-web',
      cwd: '/var/www/habibazar/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/habibazar-web-error.log',
      out_file: '/var/log/pm2/habibazar-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
    },
  ],
}
