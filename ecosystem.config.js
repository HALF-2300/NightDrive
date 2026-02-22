module.exports = {
  apps: [{
    name: 'autoelite',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    min_uptime: '10s',
    max_restarts: 10,

    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT || 1335,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 1335,
    },

    /* Logging */
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_type: 'json',

    /* Log rotation (requires pm2-logrotate module) */
    /* pm2 install pm2-logrotate                    */
    /* pm2 set pm2-logrotate:max_size 10M           */
    /* pm2 set pm2-logrotate:retain 14              */
    /* pm2 set pm2-logrotate:compress true           */

    /* Graceful shutdown */
    kill_timeout: 10000,
    listen_timeout: 8000,
    shutdown_with_message: true,

    /* Restart policy */
    exp_backoff_restart_delay: 1000,
  }],
};
