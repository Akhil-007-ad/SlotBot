import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

export const devAuthEnabled =
    import.meta.env.VITE_DEV_AUTH === 'true';

export const entraConfigured =
    Boolean(clientId && tenantId);

export const authReady =
    entraConfigured || devAuthEnabled;

export const msalInstance = authReady
    ? new PublicClientApplication({
        auth: {
            clientId:
                clientId ||
                '00000000-0000-0000-0000-000000000000',

            authority:
                `https://login.microsoftonline.com/${tenantId || 'common'
                }`,

            redirectUri:
                'http://localhost:5173',

            postLogoutRedirectUri:
                'http://localhost:5173'
        },

        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false
        }
    })
    : null;


/*
 * Login permission.
 *
 * This is Microsoft Graph delegated permission
 * for the signed-in user's basic profile.
 */
export const loginRequest = {
    scopes: ['User.Read']
};

export const apiRequest = {
    scopes: [import.meta.env.VITE_ENTRA_API_SCOPE]
};