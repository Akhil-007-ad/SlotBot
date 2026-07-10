import React, { useState, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import RoomDashboard from './components/RoomDashboard';

// Dynamically read environment variable for public cloud deployments, fallback to local backend port
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001';

const App = () => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Welcome to **SlotBot**! I can help you reserve a meeting room for **today**.\n\nType **\"book a room\"** or specify details like: *\"Book Quantum room for 4 people starting at 2:00 PM for 2 hours.\"*"
    }
  ]);
  const [session, setSession] = useState({
    step: 'AWAITING_BOOKING_INIT',
    bookingData: {
      roomName: null,
      peopleCount: null,
      durationHours: null,
      startTimeStr: null
    }
  });
  const [isTyping, setIsTyping] = useState(false);
  const [bookings, setBookings] = useState([]);

  // Fetch all bookings for today
  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Failed to fetch today's bookings:", err);
    }
  };

  // Poll for today's bookings every 10 seconds
  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (text) => {
    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const newUserMessage = {
      id: userMsgId,
      sender: 'user',
      text
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsTyping(true);

    try {
      // 2. Call backend chat API
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session })
      });

      if (!res.ok) {
        throw new Error('API server returned an error');
      }

      const data = await res.json();
      
      // 3. Update session state
      setSession(data.session);

      // Simulate typing delay for a premium experience
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: data.reply
          }
        ]);

        // If booking was confirmed or cancelled, refresh the dashboard
        if (data.bookingConfirmed) {
          fetchBookings();
        }
      }, 500);

    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: '⚠️ **Error**: Could not connect to the booking assistant. Please make sure the server is running.'
        }
      ]);
    }
  };

  const handleConfirmBooking = () => {
    handleSendMessage('confirm');
  };

  const handleCancelBooking = () => {
    handleSendMessage('cancel');
  };

  // When user clicks a room on the dashboard
  const handleRoomSelect = (roomName) => {
    handleSendMessage(`Book room ${roomName}`);
  };

  return (
    <div style={styles.appContainer} className="app-shell">
      <header style={styles.appHeader} className="glass-panel app-header">
        <div style={styles.logoRow} className="app-title-row">
          <span style={styles.logoIcon}>⚡</span>
          <h1 style={styles.logoTitle} className="text-gradient-cyan-blue app-title">SlotBot Workspace</h1>
        </div>
        <span style={styles.statusIndicator} className="app-status-indicator">● Active Session</span>
      </header>

      <main style={styles.mainLayout} className="main-layout">
        {/* Chat Window Column */}
        <div style={styles.chatCol} className="chat-column">
          <ChatWindow 
            messages={messages}
            isTyping={isTyping}
            onSendMessage={handleSendMessage}
            session={session}
            onConfirmBooking={handleConfirmBooking}
            onCancelBooking={handleCancelBooking}
          />
        </div>

        {/* Dashboard Column */}
        <div style={styles.dashboardCol} className="dashboard-column">
          <RoomDashboard 
            bookings={bookings}
            onRoomSelect={handleRoomSelect}
          />
        </div>
      </main>
    </div>
  );
};

const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    width: '100%',
    overflowX: 'hidden',
    padding: '20px',
    backgroundColor: 'var(--bg-primary)'
  },
  appHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '12px 20px',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    border: '1px solid var(--panel-border)',
    boxShadow: 'var(--card-shadow)'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    fontSize: '1.5rem',
    textShadow: '0 0 10px rgba(37, 99, 235, 0.2)'
  },
  logoTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: 'var(--accent-blue-dark)'
  },
  statusIndicator: {
    fontSize: '0.75rem',
    color: 'var(--success-text)',
    backgroundColor: 'var(--success-light)',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid var(--success-border)',
    fontWeight: '600'
  },
  mainLayout: {
    display: 'flex',
    gap: '20px',
    flexGrow: 1,
    minHeight: 0,
    overflow: 'hidden'
  },
  chatCol: {
    flex: '2 1 60%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  dashboardCol: {
    flex: '1 1 40%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  }
};

export default App;
