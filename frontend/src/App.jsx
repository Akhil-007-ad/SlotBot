import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import ChatWindow from './components/ChatWindow';
import RoomDashboard from './components/RoomDashboard';
import { loginRequest } from './authConfig';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001';
const initialSession = { step: 'COLLECTING_DETAILS', bookingData: { attendeeCount: null, date: null, startTime: null, endTime: null, tvRequired: null, selectedRoomId: null, participants: [] } };

const App = () => {
  const { instance, accounts } = useMsal();
  const devAuthEnabled = import.meta.env.VITE_DEV_AUTH === 'true';
  const account = useMemo(() => accounts[0] || (devAuthEnabled ? { name: 'Local development user', username: '' } : null), [accounts, devAuthEnabled]);
  const [messages, setMessages] = useState([{ id: 'welcome', sender: 'bot', text: 'Welcome to **SlotBot**. Tell me the attendees, time, TV need, room, or participants in any order.' }]);
  const [session, setSession] = useState(initialSession);
  const [isTyping, setIsTyping] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (!devAuthEnabled) {
      const token = await instance.acquireTokenSilent({ ...loginRequest, account });
      headers.set('Authorization', `Bearer ${token.accessToken}`);
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  }, [account, devAuthEnabled, instance]);

  const loadDashboard = useCallback(async () => {
    try {
      const [roomsResponse, bookingsResponse] = await Promise.all([apiFetch('/api/rooms'), apiFetch('/api/bookings')]);
      if (!roomsResponse.ok || !bookingsResponse.ok) throw new Error('Unable to load booking data.');
      setRooms(await roomsResponse.json());
      setBookings(await bookingsResponse.json());
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load SlotBot data.');
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!account) return;
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [account, loadDashboard]);

  const handleSendMessage = async text => {
    setMessages(previous => [...previous, { id: crypto.randomUUID(), sender: 'user', text }]);
    setIsTyping(true);
    try {
      const response = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, session }) });
      if (!response.ok) throw new Error('The booking assistant could not process that request.');
      const data = await response.json();
      setSession(data.session);
      setMessages(previous => [...previous, {
        id: crypto.randomUUID(),
        sender: 'bot',
        text: data.reply,
        roomsList: data.roomsList,
        showConflictOptions: data.showConflictOptions,
        recommendedTimeStr: data.recommendedTimeStr,
        conflictReason: data.conflictReason
      }]);
      if (data.bookingConfirmed) loadDashboard();
    } catch (chatError) {
      setMessages(previous => [...previous, { id: crypto.randomUUID(), sender: 'bot', text: `⚠️ **Error**: ${chatError.message}` }]);
    } finally { setIsTyping(false); }
  };

  if (!account) return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
      <h1 className="text-3xl font-bold text-violet-900">SlotBot</h1>
      <p className="text-slate-600">Sign in with your company account to reserve a room.</p>
      <button
        onClick={() => instance.loginRedirect(loginRequest)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        Sign in with Microsoft
      </button>
    </main>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-[Plus_Jakarta_Sans,sans-serif]">
      {/* Header */}
      <header className="flex w-full justify-between items-center bg-white/70 backdrop-blur-xl border-b border-slate-200 px-5 py-3 sticky top-0 z-10">
        <div className="flex flex-col gap-0">
          <h1 className="font-bold text-2xl text-violet-900">Welcome to SlotBot</h1>
          <span className="text-sm text-slate-500 font-medium">
            {devAuthEnabled ? 'Local development mode' : `Signed in as ${account.name || account.username}`}
          </span>
        </div>
        {!devAuthEnabled && (
          <button
            onClick={() => instance.logoutRedirect({ account })}
            className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Sign out
          </button>
        )}
      </header>

      {/* Error Banner */}
      {error && (
        <p className="mx-5 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </p>
      )}

      {/* Main layout */}
      <main className="flex gap-5 px-5 py-4 flex-1 min-h-0">
        <div className="min-w-0 flex-1">
          <ChatWindow
            messages={messages}
            isTyping={isTyping}
            onSendMessage={handleSendMessage}
            session={session}
            onConfirmBooking={() => handleSendMessage('confirm')}
            onCancelBooking={() => handleSendMessage('cancel')}
            apiFetch={apiFetch}
          />
        </div>
        <div className="min-w-0 w-[30%] shrink-0">
          <RoomDashboard
            rooms={rooms}
            bookings={bookings}
            onRoomSelect={roomName => handleSendMessage(`Book room ${roomName}`)}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
