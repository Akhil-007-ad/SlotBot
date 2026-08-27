import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { authentication } from '@microsoft/teams-js';

import './index.css';
import App from './App.jsx';

import {
  authReady,
  msalInstance,
  loginRequest,
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


/*
 * Check whether this window was opened by
 * Microsoft Teams as an authentication popup.
 */
const searchParams = new URLSearchParams(
  window.location.search
);

const isTeamsAuthPopup =
  searchParams.get('teamsAuth') === 'true';


const renderAuthMessage = (message) => {
  render(
    <main className="configuration-message">
      {message}
    </main>
  );
};


const startApplication = async () => {
  if (!authReady || !msalInstance) {
    renderAuthMessage(
      'Microsoft Entra ID has not been configured.'
    );

    return;
  }

  try {
    await msalInstance.initialize();


    /*
     * =====================================================
     * TEAMS AUTHENTICATION POPUP
     * =====================================================
     *
     * IMPORTANT:
     * Never render <App /> inside this context.
     */
    if (isTeamsAuthPopup) {

      /*
       * Save this information so that when Microsoft Entra
       * redirects back to the root URL, we still know this
       * window belongs to the Teams authentication flow.
       */
      sessionStorage.setItem(
        'slotbot_teams_auth_popup',
        'true'
      );


      renderAuthMessage(
        'Opening Microsoft sign-in...'
      );


      /*
       * Start Microsoft Entra login.
       *
       * The redirect URI remains your existing root URL.
       */
      await msalInstance.loginRedirect(
        loginRequest
      );

      return;
    }


    /*
     * Check whether this window returned from Microsoft Entra
     * as the Teams authentication popup.
     */
    const isTeamsAuthReturn =
      sessionStorage.getItem(
        'slotbot_teams_auth_popup'
      ) === 'true';


    /*
     * Process Microsoft Entra redirect response.
     */
    const redirectResponse =
      await msalInstance.handleRedirectPromise();


    if (redirectResponse?.account) {
      msalInstance.setActiveAccount(
        redirectResponse.account
      );
    }


    /*
     * =====================================================
     * TEAMS AUTHENTICATION COMPLETED
     * =====================================================
     */
    if (
      isTeamsAuthReturn &&
      redirectResponse?.account
    ) {
      sessionStorage.removeItem(
        'slotbot_teams_auth_popup'
      );

      await authentication.notifySuccess(
        'authentication-complete'
      );

      return;
    }


    /*
     * =====================================================
     * NORMAL SLOTBOT APPLICATION
     * =====================================================
     */
    render(
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    );

  } catch (error) {
    console.error(
      'Authentication initialization failed:',
      error
    );

    const isTeamsAuthReturn =
      sessionStorage.getItem(
        'slotbot_teams_auth_popup'
      ) === 'true';

    if (isTeamsAuthReturn || isTeamsAuthPopup) {
      try {
        sessionStorage.removeItem(
          'slotbot_teams_auth_popup'
        );

        await authentication.notifyFailure(
          error?.message ||
          'Microsoft sign-in failed.'
        );

        return;
      } catch (teamsError) {
        console.error(
          'Unable to notify Microsoft Teams:',
          teamsError
        );
      }
    }


    renderAuthMessage(
      'Microsoft Entra ID could not be initialized. Check the Entra configuration.'
    );
  }
};


startApplication();