import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest, apiRequest } from './authConfig';
import NavBar from './components/NavBar';

import {Navigate, Route, Routes, BrowserRouter} from 'react-router-dom'
const HomePage = lazy(() => import('./pages/HomePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const configuredApiBase = import.meta.env.VITE_API_BASE;
const API_BASE = configuredApiBase === undefined
  ? 'http://localhost:5001'
  : configuredApiBase.replace(/\/$/, '');

const App = () => {
  const { instance, accounts } = useMsal();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const account = useMemo(() => {
    return (
      accounts[0]
      
    );
  }, [accounts]);

  const apiFetch = useCallback(async (path, options = {}) => {
    if (!account) throw new Error('No Microsoft account is signed in.');
    const token = await instance.acquireTokenSilent({ ...apiRequest, account });
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token.accessToken}`);
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  }, [account, instance]);

  useEffect(() => {
    if (!account) return;
    setProfileLoading(true);
    apiFetch('/api/users/me')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load your SlotBot profile.');
        setCurrentUser(await response.json());
      })
      .finally(() => setProfileLoading(false));
  }, [account, apiFetch]);

  if (!account) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
        <h1 className="text-3xl font-bold text-violet-900">
          SlotBot
        </h1>

        <p className="text-slate-600">
          Sign in with your company account to reserve a room.
        </p>

        <button
          onClick={() =>
            instance.loginRedirect(loginRequest)
          }
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Sign in with Microsoft
        </button>
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
      <BrowserRouter>
        <NavBar account={account} instance={instance} isAdmin={currentUser?.isAdmin}/>

        
          <Suspense fallback={<PageLoading/>}>
            <Routes>
              <Route path='/' element={<HomePage account={account} apiFetch={apiFetch} currentUser={currentUser}/>}/>
              <Route path='/history' element={<HistoryPage apiFetch={apiFetch} currentUser={currentUser}/>}/>
              <Route path='/admin' element={profileLoading ? <PageLoading/> : currentUser?.isAdmin ? <AdminPage apiFetch={apiFetch}/> : <Navigate to='/' replace/>}/>
            </Routes>
          </Suspense>
      
      </BrowserRouter>

      
    </div>
  );
};

const PageLoading = () => (
  <main className="flex flex-1 items-center justify-center text-slate-500">Loading…</main>
);

export default App;
