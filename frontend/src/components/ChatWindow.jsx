import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ConfirmationCard from './ConfirmationCard';

const QUICK_SUGGESTIONS = [
  "Book a room for today",
  "Zenith room for 2 people",
  "Quantum room for 5 people",
  "Restart booking"
];

const ChatWindow = ({ messages, isTyping, onSendMessage, session, onConfirmBooking, onCancelBooking }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleSuggestionClick = (suggestion) => {
    onSendMessage(suggestion);
  };

  const showConfirmationCard = session?.step === 'AWAITING_CONFIRMATION' && session?.bookingData;

  return (
    <div style={styles.chatContainer} className="glass-panel chat-window-shell">
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.botProfile}>
          <div style={styles.botIcon}>🤖</div>
          <div>
            <h2 style={styles.botName}>SlotBot Assistant</h2>
            <p style={styles.botStatus}>● Online | Today-Only Bookings</p>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div style={styles.messagesList} className="messages-list">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        {showConfirmationCard && (
          <div style={styles.cardWrapper}>
            <ConfirmationCard 
              bookingData={session.bookingData}
              onConfirm={onConfirmBooking}
              onCancel={onCancelBooking}
            />
          </div>
        )}

        {isTyping && (
          <MessageBubble message={{ id: 'typing', sender: 'bot', text: '', isTyping: true }} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {!showConfirmationCard && (
        <div style={styles.suggestionsRow} className="suggestions-row">
          {QUICK_SUGGESTIONS.map((s, i) => (
            <button 
              key={i} 
              onClick={() => handleSuggestionClick(s)}
              style={styles.suggestionBtn}
              onMouseOver={e => {
                e.currentTarget.style.backgroundColor = 'var(--accent-blue-light)';
                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)';
                e.currentTarget.style.color = 'var(--accent-blue)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = 'var(--panel-border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={styles.inputForm} className="chat-input-form">
        <input 
          type="text" 
          className="chat-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={showConfirmationCard ? "Please click Confirm/Cancel above..." : "Type your message here..."}
          disabled={showConfirmationCard}
          style={{
            ...styles.textInput,
            backgroundColor: showConfirmationCard ? '#e2e8f0' : '#ffffff',
            cursor: showConfirmationCard ? 'not-allowed' : 'text'
          }}
        />
        <button 
          type="submit" 
          className="chat-send-btn"
          disabled={showConfirmationCard || !inputValue.trim()}
          style={{
            ...styles.sendBtn,
            opacity: showConfirmationCard || !inputValue.trim() ? 0.5 : 1,
            cursor: showConfirmationCard || !inputValue.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

const styles = {
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: '2 1 500px',
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--panel-border)',
    background: '#ffffff'
  },
  botProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  botIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'var(--accent-blue)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem'
  },
  botName: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  botStatus: {
    fontSize: '0.75rem',
    color: '#059669' // Emerald-600
  },
  messagesList: {
    flexGrow: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: '#ffffff'
  },
  cardWrapper: {
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
    paddingLeft: '42px',
    margin: '8px 0'
  },
  suggestionsRow: {
    display: 'flex',
    gap: '8px',
    padding: '8px 20px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    borderTop: '1px solid var(--panel-border)',
    backgroundColor: '#ffffff',
    scrollbarWidth: 'none'
  },
  suggestionBtn: {
    padding: '8px 14px',
    borderRadius: '16px',
    border: '1px solid var(--panel-border)',
    backgroundColor: '#f1f5f9',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0
  },
  inputForm: {
    padding: '16px 20px',
    borderTop: '1px solid var(--panel-border)',
    display: 'flex',
    gap: '10px',
    backgroundColor: '#ffffff'
  },
  textInput: {
    flexGrow: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--panel-border)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease'
  },
  sendBtn: {
    padding: '0 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--accent-blue)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)'
  }
};

export default ChatWindow;
