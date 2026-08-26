import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import ChatWindow from './components/chat/ChatWindow';
import RoomDashboard from './components/RoomDashboard';
import { loginRequest, apiRequest } from './authConfig';
import NavBar from './components/NavBar';

import {Route,Routes,BrowserRouter} from 'react-router-dom'
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001';

const App = () => {
  const { instance, accounts } = useMsal();

  const account = useMemo(() => {
    return (
      accounts[0]
      
    );
  }, [accounts]);

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
        <NavBar account={account} instance={instance}/>

        
          <Routes>
            <Route path='/' element={<HomePage account={account} instance={instance}/>}/>
            <Route path='/history' element={<HistoryPage/>}/>
            <Route path='/admin' element={<AdminPage/>}/>
          </Routes>
      
      </BrowserRouter>

      
    </div>
  );
};

export default App;