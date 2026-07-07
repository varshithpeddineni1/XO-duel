// PM2 process file (spec §10). Deliberately holds no secrets — PM2 inherits whatever env
// vars are exported in the shell at `pm2 start`/`reload` time, so deploy.sh sources the
// VPS's real .env before invoking PM2, rather than anything here referencing it directly.
// Run from anywhere: pm2 start deploy/ecosystem.config.cjs / pm2 reload ... --update-env
// (cwd is derived from this file's own location, not the invoking shell's directory, so it
// doesn't matter where deploy.sh happens to be when it calls pm2).
module.exports = {
  apps: [
    {
      name: 'xo-duel-server',
      cwd: `${__dirname}/../server`,
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
