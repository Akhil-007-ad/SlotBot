import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { authentication } from '@microsoft/teams-js';

import './index.css';
import App from './App.jsx';

import {
  authReady,
  msalInstance,
} from './authConfig.js';

const root = createRoot(
  document.getElementById('root')
);

const render = (content) => {
  root.render(
    <StrictMode>
      {content}
    </StrictMode>
  );
};


const startApplication = async () => {
  if (!authReady || !msalInstance) {
    render(
      <main className="configuration-message">
        Microsoft Entra ID has not been configured.
        Add the required environment variables.
      </main>
    );

    return;
  }

  try {
    await msalInstance.initialize();

    const isTeamsAuthPopup =
      localStorage.getItem(
        'slotbot_teams_auth_in_progress'
      ) === 'true';

    const redirectResponse =
      await msalInstance.handleRedirectPromise();

    if (redirectResponse?.account) {
      msalInstance.setActiveAccount(
        redirectResponse.account
      );
    }


    /*
     * This window is the Teams authentication popup.
     *
     * Complete authentication and tell Teams
     * to close the popup.
     */
    if (
      isTeamsAuthPopup &&
      redirectResponse?.account
    ) {
      localStorage.removeItem(
        'slotbot_teams_auth_in_progress'
      );

      await authentication.notifySuccess(
        'authentication-complete'
      );

      return;
    }


    /*
     * Normal SlotBot application.
     */
    render(
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    );

  } catch (error) {
    console.error(
      'MSAL initialization failed:',
      error
    );

    const isTeamsAuthPopup =
      localStorage.getItem(
        'slotbot_teams_auth_in_progress'
      ) === 'true';

    if (isTeamsAuthPopup) {
      try {
        localStorage.removeItem(
          'slotbot_teams_auth_in_progress'
        );

        await authentication.notifyFailure(
          error?.message ||
            'Microsoft authentication failed.'
        );

        return;
      } catch (teamsError) {
        console.error(
          'Unable to notify Teams:',
          teamsError
        );
      }
    }

    render(
      <main className="configuration-message">
        Microsoft Entra ID could not be initialized.
        Check the Entra configuration and redirect URI.
      </main>
    );
  }
};


startApplication();