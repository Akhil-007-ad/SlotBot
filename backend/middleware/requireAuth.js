import { createRemoteJWKSet, jwtVerify } from 'jose';
import '../config/env.js';
import User from '../models/User.js';

const tenantId = process.env.ENTRA_TENANT_ID;
const apiClientId = process.env.ENTRA_API_CLIENT_ID;

const issuer = tenantId
  ? `https://sts.windows.net/${tenantId}/`
  : null;
const jwks = tenantId
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  : null;

export const isEntraConfigured = () => Boolean(tenantId && apiClientId);

const initialAdminEmails = new Set(
  String(process.env.INITIAL_ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
);

const attachLocalUser = async (req, identity, next) => {
  const normalizedEmail = identity.email?.toLowerCase() || null;
  let existing = await User.findOne({ entraId: identity.id });
  const emailUser = normalizedEmail
    ? await User.findOne({ email: normalizedEmail })
    : null;

  if (existing && emailUser && !existing._id.equals(emailUser._id)) {
    existing.isAdmin = existing.isAdmin || emailUser.isAdmin;
    await User.deleteOne({ _id: emailUser._id });
  } else if (!existing && emailUser) {
    existing = emailUser;
  }

  const user = existing || new User({
    entraId: identity.id,
    isAdmin: Boolean(normalizedEmail && initialAdminEmails.has(normalizedEmail))
  });

  user.entraId = identity.id;
  user.email = normalizedEmail;
  user.name = identity.name;
  user.department = identity.department;
  await user.save();

  req.user = {
    ...identity,
    isAdmin: user.isAdmin,
    localUserId: user.id
  };
  next();
};

export const requireAuth = async (req, res, next) => {
  if (!isEntraConfigured()) {
    return res.status(503).json({ error: 'Microsoft Entra ID is not configured on this server.' });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'A Microsoft Entra access token is required.' });

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: [apiClientId, `api://${apiClientId}`]
    });

    const identity = {
      id:          payload.oid          || payload.sub,
      email:       payload.preferred_username || payload.email || payload.upn || null,
      name:        payload.name         || payload.preferred_username || 'SlotBot user',
      // 'department' is an optional claim — must be configured in the Azure app manifest
      // App Registration → Token configuration → Add optional claim → Access token → department
      department:  payload.department   || '',
      // Forward the raw bearer token so Graph OBO calls can use it
      accessToken: token
    };
    await attachLocalUser(req, identity, next);
  } catch {
    res.status(401).json({ error: 'Your Microsoft Entra session is invalid or has expired.' });
  }
};
