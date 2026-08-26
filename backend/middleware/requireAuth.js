import { createRemoteJWKSet, jwtVerify,decodeProtectedHeader, decodeJwt } from 'jose';
import '../config/env.js';

const tenantId = process.env.ENTRA_TENANT_ID;
const apiClientId = process.env.ENTRA_API_CLIENT_ID;

const issuer = tenantId
  ? `https://sts.windows.net/${tenantId}/`
  : null;
const jwks = tenantId
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  : null;

export const isEntraConfigured = () => Boolean(tenantId && apiClientId);

export const requireAuth = async (req, res, next) => {
  // ─── Dev bypass ──────────────────────────────────────────────────────────────
  if (process.env.ALLOW_DEV_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    req.user = {
      id:          process.env.DEV_USER_ID         || 'local-development-user',
      email:       process.env.DEV_USER_EMAIL       || 'developer@example.com',
      name:        process.env.DEV_USER_NAME        || 'Local Developer',
      department:  process.env.DEV_USER_DEPARTMENT  || '',
      // No real token in dev mode — Graph calls are skipped when MS365_ENABLED=false
      accessToken: null
    };
    return next();
  }

  if (!isEntraConfigured()) {
    return res.status(503).json({ error: 'Microsoft Entra ID is not configured on this server.' });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'A Microsoft Entra access token is required.' });

  const header = decodeProtectedHeader(token);
  const decoded = decodeJwt(token);

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: [apiClientId, `api://${apiClientId}`]
    });

    req.user = {
      id:          payload.oid          || payload.sub,
      email:       payload.preferred_username || payload.email || null,
      name:        payload.name         || payload.preferred_username || 'SlotBot user',
      // 'department' is an optional claim — must be configured in the Azure app manifest
      // App Registration → Token configuration → Add optional claim → Access token → department
      department:  payload.department   || '',
      // Forward the raw bearer token so Graph OBO calls can use it
      accessToken: token
    };
    next();
  } catch (error) {
    console.error('Entra token validation failed:', error.code || error.message);
    res.status(401).json({ error: 'Your Microsoft Entra session is invalid or has expired.' });
  }
};
