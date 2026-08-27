import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useMsal } from '@azure/msal-react';
import { app } from '@microsoft/teams-js';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { apiRequest, loginRequest } from './authConfig';
import NavBar from './components/NavBar';
import Loading from './components/Loading';
import PageLoading from './components/PageLoading';

const HomePage = lazy(() => import('./pages/HomePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const configuredApiBase = import.meta.env.VITE_API_BASE;

const API_BASE =
  configuredApiBase?.replace(/\/$/, '') || 'http://localhost:5001';


const App = () => {
  const { instance, accounts } = useMsal();

  const [currentUser, setCurrentUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [isInTeams, setIsInTeams] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);


  /*
   * Detect whether SlotBot is running inside Microsoft Teams.
   */
  useEffect(() => {
    const initializeTeams = async () => {
      try {
        await app.initialize();

        setIsInTeams(true);

        console.log('SlotBot is running inside Microsoft Teams');
      } catch {
        setIsInTeams(false);

        console.log('SlotBot is running in a normal browser');
      } finally {
        setTeamsLoading(false);
      }
    };

    initializeTeams();
  }, []);


  /*
   * Get the currently signed-in Microsoft account.
   */
  const account = useMemo(() => {
    return accounts[0] || null;
  }, [accounts]);


  /*
   * Login flow.
   *
   * Normal browser:
   *   loginRedirect()
   *
   * Microsoft Teams:
   *   loginPopup()
   */
  const handleLogin = async () => {
    try {
      setLoginLoading(true);
      setLoginError(null);

      if (isInTeams) {
        await instance.loginPopup(loginRequest);
      } else {
        await instance.loginRedirect(loginRequest);
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);

      setLoginError(
        error?.message ||
          'Microsoft sign-in failed. Please try again.'
      );
    } finally {
      setLoginLoading(false);
    }
  };


  /*
   * Authenticated API request helper.
   */
  const apiFetch = useCallback(
    async (path, options = {}) => {
      if (!account) {
        throw new Error('No Microsoft account is signed in.');
      }

      const tokenResponse = await instance.acquireTokenSilent({
        ...apiRequest,
        account,
      });

      const headers = new Headers(options.headers);

      headers.set(
        'Authorization',
        `Bearer ${tokenResponse.accessToken}`
      );

      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    },
    [account, instance]
  );


  /*
   * Load the current SlotBot user profile.
   */
  useEffect(() => {
    if (!account) {
      setCurrentUser(null);
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setProfileLoading(true);

        const response = await apiFetch('/api/users/me');

        if (!response.ok) {
          throw new Error(
            'Unable to load your SlotBot profile.'
          );
        }

        const user = await response.json();

        setCurrentUser(user);
      } catch (error) {
        console.error(
          'Unable to load SlotBot profile:',
          error
        );
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [account, apiFetch]);


  /*
   * Wait until we know whether we are running in Teams.
   */
  if (teamsLoading) {
    return <Loading />;
  }


  /*
   * User is not authenticated.
   */
  if (!account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-3xl font-bold text-violet-900">
          SlotBot
        </h1>

        <p className="text-slate-600">
          Sign in with your company account to reserve a room.
        </p>

        {loginError && (
          <p className="max-w-md text-sm text-red-600">
            {loginError}
          </p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loginLoading}
          className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loginLoading
            ? 'Signing in...'
            : 'Sign in with Microsoft'}
        </button>
      </main>
    );
  }


  /*
   * User is authenticated, but profile is loading.
   */
  if (profileLoading) {
    return <Loading />;
  }


  /*
   * Main authenticated application.
   */
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
        <NavBar
          account={account}
          instance={instance}
          isAdmin={currentUser?.isAdmin}
        />

        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  account={account}
                  apiFetch={apiFetch}
                  currentUser={currentUser}
                />
              }
            />

            <Route
              path="/history"
              element={
                <HistoryPage
                  apiFetch={apiFetch}
                  currentUser={currentUser}
                />
              }
            />

            <Route
              path="/admin"
              element={
                currentUser?.isAdmin ? (
                  <AdminPage apiFetch={apiFetch} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
};

export default App;