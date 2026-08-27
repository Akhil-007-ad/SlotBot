import React, { useCallback, useEffect, useState } from 'react'
import ChatWindow from '../components/chat/ChatWindow'
import RoomDashboard from '../components/RoomDashboard'
import Loading from '../components/Loading';

const HomePage = ({account,apiFetch,currentUser}) => {
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
    const [bookings, setBookings] = useState({ today: [], tomorrow: [] });
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');

    const [roomsLoading,setRoomsLoading]=useState(false)

    /**
     * Load rooms and bookings.
     */
    const loadDashboard = useCallback(async () => {
        try {
            setRoomsLoading(true)
            const [roomsResponse, todayResponse, tomorrowResponse] =
                await Promise.all([
                    apiFetch('/api/rooms'),
                    apiFetch('/api/bookings?day=today'),
                    apiFetch('/api/bookings?day=tomorrow')
                ]);

            if (!roomsResponse.ok || !todayResponse.ok || !tomorrowResponse.ok) {
                throw new Error('Unable to load booking data.');
            }

            setRooms(await roomsResponse.json());
            setBookings({
                today: await todayResponse.json(),
                tomorrow: await tomorrowResponse.json()
            });
            setError('');
        } catch (loadError) {
            setError(
                loadError.message ||
                'Unable to load SlotBot data.'
            );
        }
        finally{
            setRoomsLoading(false)
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

    if(roomsLoading){
        return(
            <Loading/>
        )
    }

    return (
        <div>
            {error && <p className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
                        isAdmin={currentUser?.isAdmin === true}
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
