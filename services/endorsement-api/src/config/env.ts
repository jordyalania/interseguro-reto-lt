export interface AppConfig {
  port: number;
  databaseUrl: string;
  logging: boolean;
  docs: boolean;
  jwt: {
    privateKey: string;
    publicKey: string;
    issuer: string;
    audience: string;
    ttlSeconds: number;
  };
  demoUser: {
    username: string;
    password: string;
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function decodePem(env: NodeJS.ProcessEnv, name: string): string {
  return Buffer.from(required(env, name), 'base64').toString('utf8');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3001),
    databaseUrl: required(env, 'DATABASE_URL'),
    logging: env.LOG_ENABLED !== 'false',
    docs: env.DOCS_ENABLED !== 'false',
    jwt: {
      privateKey: decodePem(env, 'JWT_PRIVATE_KEY_B64'),
      publicKey: decodePem(env, 'JWT_PUBLIC_KEY_B64'),
      issuer: env.JWT_ISSUER ?? 'endorsement-api',
      audience: env.JWT_AUDIENCE ?? 'interseguro-reto',
      ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 900),
    },
    demoUser: {
      username: env.DEMO_USERNAME ?? 'demo',
      password: required(env, 'DEMO_PASSWORD'),
    },
  };
}
