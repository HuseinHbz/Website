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
    },
    {
      name: 'habibazar-api',
      cwd: '/var/www/habibazar/api',
      script: 'dist/server.js',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/log/pm2/habibazar-api-error.log',
      out_file: '/var/log/pm2/habibazar-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
