import { isMS365Enabled } from './graphService.js';
import { ClientSecretCredential, OnBehalfOfCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

/**
 * Builds a Microsoft Graph client using the
 * On-Behalf-Of (OBO) authentication flow.
 *
 * The backend exchanges the user's API token for
 * a Microsoft Graph access token.
 */
const buildUserGraphClient = (userAccessToken) => {
  const credential = new OnBehalfOfCredential({
    tenantId: process.env.MS_TENANT_ID,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    userAssertionToken: userAccessToken
  });

  const authProvider = new TokenCredentialAuthenticationProvider(
    credential,
    {
      scopes: ['https://graph.microsoft.com/.default']
    }
  );

  return Client.initWithMiddleware({ authProvider });
};

const buildApplicationGraphClient = () => {
  const credential = new ClientSecretCredential(
    process.env.MS_TENANT_ID,
    process.env.MS_CLIENT_ID,
    process.env.MS_CLIENT_SECRET
  );
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });
  return Client.initWithMiddleware({ authProvider });
};


/**
 * Checks whether a Microsoft Graph error is caused by
 * insufficient permissions.
 */
const isInsufficientPrivilegesError = (error) => {
  const statusCode =
    error?.statusCode ||
    error?.status ||
    error?.response?.status;

  const errorCode =
    error?.code ||
    error?.body?.error?.code ||
    error?.response?.data?.error?.code;

  const errorMessage =
    error?.message ||
    error?.body?.error?.message ||
    error?.response?.data?.error?.message ||
    '';

  return (
    statusCode === 403 ||
    errorCode === 'Authorization_RequestDenied' ||
    errorCode === 'InsufficientPrivileges' ||
    errorMessage.toLowerCase().includes('insufficient privileges')
  );
};


/**
 * Normalizes a search query.
 */
const normalizeQuery = (query) => {
  return String(query || '').trim();
};


/**
 * PRIORITY 1
 *
 * Search the organization's Microsoft Entra directory.
 *
 * Requires:
 * Microsoft Graph → Delegated → User.Read.All
 */
const searchOrganizationUsersWithClient = async (client, query, top = 10, allPages = false) => {
  const escapedQuery = query.replace(/["\\]/g, character => `\\${character}`);

  const request = client
    .api('/users')
    .select('id,displayName,userPrincipalName,mail,department')
    .top(top);

  if (query) {
    request
      .header('ConsistencyLevel', 'eventual')
      .search(
        `"displayName:${escapedQuery}" OR ` +
        `"mail:${escapedQuery}" OR ` +
        `"userPrincipalName:${escapedQuery}"`
      );
  }

  let response = await request.get();
  const directoryUsers = [...(response.value || [])];

  while (allPages && response['@odata.nextLink']) {
    response = await client.api(response['@odata.nextLink']).get();
    directoryUsers.push(...(response.value || []));
  }

  return directoryUsers
    .map((user) => ({
      id: user.id,
      name: user.displayName || '',
      email: user.mail || user.userPrincipalName || '',
      department: user.department || '',
      source: 'directory'
    }))
    .filter((user) => user.name || user.email);
};

export const searchOrganizationUsers = async (query, userAccessToken) => {
  if (!isMS365Enabled()) {
    const error = new Error('Microsoft 365 organization search is currently disabled.');
    error.status = 503;
    throw error;
  }
  if (!userAccessToken) {
    const error = new Error('A real Microsoft authentication token is required for organization search.');
    error.status = 401;
    throw error;
  }
  try {
    return await searchOrganizationUsersWithClient(
      buildUserGraphClient(userAccessToken),
      normalizeQuery(query),
      999,
      true
    );
  } catch (error) {
    if (isInsufficientPrivilegesError(error)) {
      const permissionError = new Error('Microsoft Graph User.Read.All permission is required to manage organization users.');
      permissionError.status = 403;
      throw permissionError;
    }
    throw error;
  }
};


/**
 * PRIORITY 2
 *
 * Search the signed-in user's relevant people.
 *
 * Requires:
 * Microsoft Graph → Delegated → People.Read
 *
 * This is NOT a full organization directory search.
 */
const searchRelevantPeople = async (client, query) => {
  const response = await client
    .api('/me/people')
    .select('displayName,scoredEmailAddresses,department')
    .top(100)
    .get();

  const lowerQuery = query.toLowerCase();

  const people = (response.value || [])
    .map((person) => {
      const emailAddresses = Array.isArray(person.scoredEmailAddresses)
        ? person.scoredEmailAddresses
        : [];

      const primaryEmail =
        emailAddresses.find((item) => item?.address)?.address || '';

      return {
        name: person.displayName || '',
        email: primaryEmail,
        department: person.department || '',
        source: 'people'
      };
    })
    .filter((person) => person.name || person.email);

  // /me/people is a relevant-people list.
  // We filter locally so the behavior matches the SlotBot search box.
  if (!query) {
    return people.slice(0, 10);
  }

  return people
    .filter((person) => {
      return (
        person.name.toLowerCase().includes(lowerQuery) ||
        person.email.toLowerCase().includes(lowerQuery)
      );
    })
    .slice(0, 10);
};


/**
 * MAIN EMPLOYEE SEARCH FUNCTION
 *
 * Priority:
 *
 * 1. /users
 *    Permission: User.Read.All
 *
 * 2. /me/people
 *    Permission: People.Read
 *
 * 3. Throw an actual error
 */
export const searchEmployees = async (query, userAccessToken) => {
  const searchQuery = normalizeQuery(query);

  // Microsoft 365 integration is required.
  if (!isMS365Enabled()) {
    throw new Error(
      'Microsoft 365 employee search is currently disabled.'
    );
  }

  // OBO flow requires the logged-in user's token.
  if (!userAccessToken) {
    throw new Error(
      'Microsoft authentication token is missing. Please sign in again.'
    );
  }

  const client = buildUserGraphClient(userAccessToken);


  // =====================================================
  // PRIORITY 1: ORGANIZATION-WIDE USER SEARCH
  // Requires User.Read.All
  // =====================================================
  try {
    const users = await searchOrganizationUsersWithClient(
      client,
      searchQuery
    );

    return {
      success: true,
      source: 'directory',
      results: users
    };

  } catch (directoryError) {
    // Only fall back to People.Read when the directory
    // request failed because User.Read.All is unavailable.
    if (!isInsufficientPrivilegesError(directoryError)) {
      throw new Error(
        `Unable to search the organization directory: ${directoryError.message}`
      );
    }

  }

  // =====================================================
  // PRIORITY 2: APPLICATION DIRECTORY SEARCH
  // Requires application User.Read.All + admin consent.
  // =====================================================
  try {
    const users = await searchOrganizationUsersWithClient(
      buildApplicationGraphClient(),
      searchQuery
    );
    return {
      success: true,
      source: 'directory-application',
      results: users
    };
  } catch {}


  // =====================================================
  // PRIORITY 3: RELEVANT PEOPLE SEARCH
  // Requires People.Read
  // =====================================================
  try {
    const people = await searchRelevantPeople(
      client,
      searchQuery
    );

    return {
      success: true,
      source: 'people',
      results: people
    };

  } catch {
    // =====================================================
    // PRIORITY 3: ACTUAL ERROR
    // No mock employee fallback.
    // =====================================================
    throw new Error(
      'Unable to search employees. ' +
      'The organization directory search and People search are both unavailable.'
    );
  }
};
