module.exports = {
  apps: [{
    name: 'hamees-inventory',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3009',
    cwd: '/home/gagneet/hamees',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/home/gagneet/hamees/logs/err.log',
    out_file: '/home/gagneet/hamees/logs/out.log',
    time: true,
  }]
}
