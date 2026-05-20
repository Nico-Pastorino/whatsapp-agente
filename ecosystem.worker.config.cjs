module.exports = {
  apps: [
    {
      name: "whatsapp-agente-worker",
      cwd: "/home/claw/whatsapp-agente",
      script: "npm",
      args: "run start:worker",
      interpreter: "none",
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      max_restarts: 1000,
      env_file: ".env.worker",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
