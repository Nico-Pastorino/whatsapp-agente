const DEFAULT_WORKER_INSTANCE_NAME = "primary";
const DEFAULT_BAILEYS_AUTH_BASE_PATH = "/data/baileys-auth";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBusinessId(): string {
  return getRequiredEnv("BUSINESS_ID");
}

export function getWorkerInstanceName(): string {
  return readEnv("WORKER_INSTANCE_NAME") ?? DEFAULT_WORKER_INSTANCE_NAME;
}

export function getBaileysAuthBasePath(): string {
  return readEnv("BAILEYS_AUTH_BASE_PATH") ?? DEFAULT_BAILEYS_AUTH_BASE_PATH;
}

export function getDashboardCredentials(): {
  user: string | null;
  password: string | null;
} {
  return {
    user: readEnv("DASHBOARD_USER") ?? null,
    password: readEnv("DASHBOARD_PASSWORD") ?? null,
  };
}

