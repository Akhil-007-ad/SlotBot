import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE;
const applicationUrl = import.meta.env.VITE_REDIRECT_URI || window.location.origin;

export const entraConfigured =
    Boolean(clientId && tenantId && apiScope);

export const authReady =
    entraConfigured;

export const msalInstance = authReady
    ? new PublicClientApplication({
        auth: {
            clientId:
                clientId ||
                '00000000-0000-0000-0000-000000000000',

            authority:
                `https://login.microsoftonline.com/${tenantId || 'common'
                }`,

            redirectUri: applicationUrl,

            postLogoutRedirectUri: applicationUrl
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
    scopes: [apiScope]
};
