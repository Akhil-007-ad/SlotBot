import React from 'react';

const formatMessageText = (text) => {
  if (!text) return '';
  
  // Replace double asterisks with bold tags
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace newlines with break lines
  formatted = formatted.replace(/\n/g, '<br />');
  
  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div style={styles.systemContainer}>
        <div style={styles.systemText}>{message.text}</div>
      </div>
    );
  }

  return (
    <div style={{
      ...styles.messageRow,
      justifyContent: isUser ? 'flex-end' : 'flex-start'
    }} className="message-row">
      {!isUser && (
        <div style={styles.botAvatar}>
          <span>🤖</span>
        </div>
      )}
      
      <div style={{
        ...styles.bubble,
        background: isUser 
          ? 'var(--accent-blue)'
          : '#f1f5f9',
        border: isUser
          ? '1px solid rgba(37, 99, 235, 0.1)'
          : '1px solid var(--panel-border)',
        borderRadius: isUser
          ? '12px 12px 2px 12px'
          : '12px 12px 12px 2px',
        boxShadow: isUser 
          ? '0 4px 10px rgba(37, 99, 235, 0.15)'
          : 'none',
        color: isUser ? '#fff' : 'var(--text-primary)'
      }} className="message-bubble">
        {message.isTyping ? (
          <div style={styles.typingIndicator}>
            <span style={styles.typingDot} className="typing-dot-1"></span>
            <span style={styles.typingDot} className="typing-dot-2"></span>
            <span style={styles.typingDot} className="typing-dot-3"></span>
          </div>
        ) : (
          <div style={styles.textContainer}>
            {formatMessageText(message.text)}
          </div>
        )}
      </div>

      {isUser && (
        <div style={styles.userAvatar}>
          <span>👤</span>
        </div>
      )}
    </div>
  );
};

// Add raw CSS for the typing indicator animations
const injectTypingStyles = () => {
  if (typeof document === 'undefined') return;
  const styleId = 'typing-indicator-styles';
  if (document.getElementById(styleId)) return;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = styleId;
  styleSheet.type = 'text/css';
  styleSheet.innerText = `
    @keyframes typingPulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    .typing-dot-1 { animation: typingPulse 1.2s infinite ease-in-out; }
    .typing-dot-2 { animation: typingPulse 1.2s infinite ease-in-out 0.2s; }
    .typing-dot-3 { animation: typingPulse 1.2s infinite ease-in-out 0.4s; }
  `;
  document.head.appendChild(styleSheet);
};

injectTypingStyles();

const styles = {
  messageRow: {
    display: 'flex',
    gap: '10px',
    margin: '6px 0',
    width: '100%',
    alignItems: 'flex-end',
    animation: 'fadeIn 0.2s ease-out forwards'
  },
  bubble: {
    padding: '10px 14px',
    maxWidth: '75%',
    fontSize: '0.9rem',
    lineHeight: '1.45',
    wordBreak: 'break-word'
  },
  textContainer: {
    display: 'block'
  },
  botAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--accent-blue-light)',
    border: '1px solid rgba(37, 99, 235, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    marginBottom: '2px'
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#ffffff',
    border: '1px solid var(--panel-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    marginBottom: '2px'
  },
  systemContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0',
    width: '100%'
  },
  systemText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    background: '#e2e8f0',
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid var(--panel-border)'
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    height: '14px',
    padding: '2px 4px'
  },
  typingDot: {
    width: '6px',
    height: '6px',
    backgroundColor: 'var(--text-secondary)',
    borderRadius: '50%',
    display: 'inline-block'
  }
};

export default MessageBubble;
