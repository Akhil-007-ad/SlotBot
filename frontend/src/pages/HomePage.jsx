import React, { useCallback, useEffect, useState } from 'react'
import ChatWindow from '../components/chat/ChatWindow'
import RoomDashboard from '../components/RoomDashboard'
import { apiRequest } from '../authConfig';

const HomePage = ({account,instance}) => {
    const API_BASE=import.meta.env.VITE_API_BASE;
    const initialSession = {
      step: 'COLLECTING_DETAILS',
      bookingData: {
        attendeeCount: null,
        date: null,
        startTime: null,
        endTime: null,
        tvRequired: null,
        selectedRoomId: null,
        participants: null
      }
    };

    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            sender: 'bot',
            text: 'Welcome to **SlotBot**. Please provide details for booking.'
        }
    ]);

    const [session, setSession] = useState(initialSession);
    const [isTyping, setIsTyping] = useState(false);
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');

    const apiFetch = useCallback(
        async (path, options = {}) => {
            const headers = new Headers(options.headers);

            if (!account) {
                throw new Error('No Microsoft account is signed in.');
            }

            const token = await instance.acquireTokenSilent({
                ...apiRequest,
                account
            });

            headers.set(
                'Authorization',
                `Bearer ${token.accessToken}`
            );

            return fetch(`${API_BASE}${path}`, {
                ...options,
                headers
            });
        },
        [account, instance]
    );

    /**
     * Load rooms and bookings.
     */
    const loadDashboard = useCallback(async () => {
        try {
            const [roomsResponse, bookingsResponse] =
                await Promise.all([
                    apiFetch('/api/rooms'),
                    apiFetch('/api/bookings')
                ]);

            if (!roomsResponse.ok || !bookingsResponse.ok) {
                throw new Error('Unable to load booking data.');
            }

            setRooms(await roomsResponse.json());
            setBookings(await bookingsResponse.json());
            setError('');
        } catch (loadError) {
            setError(
                loadError.message ||
                'Unable to load SlotBot data.'
            );
        }
    }, [apiFetch]);

    /**
     * Load dashboard when the user signs in.
     * Refresh every 30 seconds.
     */
    useEffect(() => {
        if (!account) return;

        loadDashboard();

        const interval =
            setInterval(loadDashboard, 30000);

        return () => clearInterval(interval);
    }, [account, loadDashboard]);

    /**
     * Send a message to the SlotBot backend.
     */
    const handleSendMessage = async (text) => {
        setMessages((previous) => [
            ...previous,
            {
                id: crypto.randomUUID(),
                sender: 'user',
                text
            }
        ]);

        setIsTyping(true);

        try {
            const response = await apiFetch('/api/chat', {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    message: text,
                    session
                })
            });

            if (!response.ok) {
                console.log(response)
                throw new Error(
                    'The booking assistant could not process that request.'
                );
            }

            const data = await response.json();

            setSession(data.session);

            setMessages((previous) => [
                ...previous,
                {
                    id: crypto.randomUUID(),
                    sender: 'bot',
                    text: data.reply,
                    roomsList: data.roomsList,
                    showConflictOptions: data.showConflictOptions,
                    recommendedTimeStr: data.recommendedTimeStr,
                    conflictReason: data.conflictReason
                }
            ]);

            if (data.bookingConfirmed) {
                loadDashboard();
            }
        } catch (chatError) {
            setMessages((previous) => [
                ...previous,
                {
                    id: crypto.randomUUID(),
                    sender: 'bot',
                    text: `⚠️ **Error**: ${chatError.message}`
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div>
            {/* Main Layout */}
            <main className="flex gap-5 px-5 py-4 flex-1 min-h-0">

                {/* Chat */}
                <div className="min-w-0 flex-1">
                    <ChatWindow
                        messages={messages}
                        isTyping={isTyping}
                        onSendMessage={handleSendMessage}
                        session={session}
                        onConfirmBooking={() =>
                            handleSendMessage('confirm')
                        }
                        onCancelBooking={() =>
                            handleSendMessage('cancel')
                        }
                        apiFetch={apiFetch}
                    />
                </div>

                {/* Room Dashboard */}
                <div className="min-w-0 w-[30%] shrink-0">
                    <RoomDashboard
                        rooms={rooms}
                        bookings={bookings}
                        onRoomSelect={(roomName) =>
                            handleSendMessage(
                                `Book room ${roomName}`
                            )
                        }
                    />
                </div>
            </main>

        </div>
    )
}

export default HomePage
