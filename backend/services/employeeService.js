import { isMS365Enabled } from './graphService.js';
import { OnBehalfOfCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

const mockEmployees = [
  { name: 'Anirudh', email: 'anirudh@techwave.com', department: 'IT' },
  { name: 'Akhil', email: 'akhil@techwave.com', department: 'IT' },
  { name: 'Shaik', email: 'shaik@techwave.com', department: 'IT' },
  { name: 'Jane Smith', email: 'jane.smith@techwave.com', department: 'HR' },
  { name: 'John Doe', email: 'john.doe@techwave.com', department: 'Engineering' },
  { name: 'Developer', email: 'developer@example.com', department: 'IT' }
];

const buildUserGraphClient = (userAccessToken) => {
  const credential = new OnBehalfOfCredential({
    tenantId:           process.env.MS_TENANT_ID,
    clientId:           process.env.MS_CLIENT_ID,
    clientSecret:       process.env.MS_CLIENT_SECRET,
    userAssertionToken: userAccessToken
  });

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });

  return Client.initWithMiddleware({ authProvider });
};

export const searchEmployees = async (query, userAccessToken) => {
  if (isMS365Enabled() && userAccessToken) {
    try {
      const client = buildUserGraphClient(userAccessToken);
      let filterClause = '';
      if (query) {
        const escaped = query.replace(/'/g, "''");
        filterClause = `startswith(displayName,'${escaped}') or startswith(userPrincipalName,'${escaped}') or startswith(mail,'${escaped}')`;
      }
      
      const request = client.api('/users').select('displayName,userPrincipalName,mail,department').top(10);
      if (filterClause) {
        request.filter(filterClause);
      }
      
      const response = await request.get();
      if (response.value && response.value.length > 0) {
        return response.value.map(user => ({
          name: user.displayName,
          email: user.userPrincipalName || user.mail,
          department: user.department || ''
        }));
      }
    } catch (error) {
      console.error('MS Graph employee search failed (falling back to mock):', error.message);
    }
  }

  // Fallback to mock search
  const lowerQuery = query.toLowerCase();
  return mockEmployees.filter(emp => 
    emp.name.toLowerCase().includes(lowerQuery) || 
    emp.email.toLowerCase().includes(lowerQuery)
  );
};
