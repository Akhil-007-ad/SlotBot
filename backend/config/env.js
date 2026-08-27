import dotenv from 'dotenv';

dotenv.config();

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const frontendOrigins = String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parsePositiveInteger(process.env.PORT, 5001),
  mongoUri: process.env.MONGODB_URI,
  frontendOrigins,
  trustProxy: process.env.TRUST_PROXY === 'true',
  jsonLimit: process.env.JSON_BODY_LIMIT || '100kb',
  rateLimitWindowMs: parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 300)
};

export const validateConfig = () => {
  const missing = [];

  if (!config.mongoUri) missing.push('MONGODB_URI');
  if (!process.env.ENTRA_TENANT_ID) missing.push('ENTRA_TENANT_ID');
  if (!process.env.ENTRA_API_CLIENT_ID) missing.push('ENTRA_API_CLIENT_ID');
  if (config.frontendOrigins.length === 0) missing.push('FRONTEND_ORIGIN');

  if (process.env.MS365_ENABLED === 'true') {
    for (const name of ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET']) {
      if (!process.env[name]) missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${[...new Set(missing)].join(', ')}`);
  }
};
