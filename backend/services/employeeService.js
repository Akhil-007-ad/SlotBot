import { isMS365Enabled } from './graphService.js';
import { OnBehalfOfCredential } from '@azure/identity';
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
const searchOrganizationUsers = async (client, query) => {
  const escapedQuery = query.replace(/'/g, "''");

  const request = client
    .api('/users')
    .select('displayName,userPrincipalName,mail,department')
    .top(10);

  if (query) {
    const filterClause =
      `startswith(displayName,'${escapedQuery}') or ` +
      `startswith(userPrincipalName,'${escapedQuery}') or ` +
      `startswith(mail,'${escapedQuery}')`;

    request.filter(filterClause);
  }

  const response = await request.get();

  return (response.value || [])
    .map((user) => ({
      name: user.displayName || '',
      email: user.mail || user.userPrincipalName || '',
      department: user.department || '',
      source: 'directory'
    }))
    .filter((user) => user.name || user.email);
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
    console.log(
      '[Employee Search] Priority 1: Searching organization directory'
    );

    const users = await searchOrganizationUsers(
      client,
      searchQuery
    );

    console.log(
      `[Employee Search] Directory search successful. Found ${users.length} user(s).`
    );

    return {
      success: true,
      source: 'directory',
      results: users
    };

  } catch (directoryError) {
    console.warn(
      '[Employee Search] Directory search failed:',
      directoryError.message
    );

    // Only fall back to People.Read when the directory
    // request failed because User.Read.All is unavailable.
    if (!isInsufficientPrivilegesError(directoryError)) {
      throw new Error(
        `Unable to search the organization directory: ${directoryError.message}`
      );
    }

    console.log(
      '[Employee Search] User.Read.All unavailable. Falling back to People.Read.'
    );
  }


  // =====================================================
  // PRIORITY 2: RELEVANT PEOPLE SEARCH
  // Requires People.Read
  // =====================================================
  try {
    console.log(
      '[Employee Search] Priority 2: Searching relevant people'
    );

    const people = await searchRelevantPeople(
      client,
      searchQuery
    );

    console.log(
      `[Employee Search] People search successful. Found ${people.length} person(s).`
    );

    return {
      success: true,
      source: 'people',
      results: people
    };

  } catch (peopleError) {
    console.error(
      '[Employee Search] People search also failed:',
      peopleError.message
    );

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