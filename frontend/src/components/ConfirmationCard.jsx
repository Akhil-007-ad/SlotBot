import React from 'react';

const ConfirmationCard = ({ bookingData, onConfirm, onCancel }) => {
  const { roomName, peopleCount, durationHours, startTimeStr } = bookingData;

  const formatTimeStr = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getEndTimeStr = (timeStr, duration) => {
    if (!timeStr || !duration) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    const end = new Date(d.getTime() + duration * 60 * 60 * 1000);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div style={styles.container} className="glass-panel animate-fade-in">
      <div style={styles.header}>
        <span style={styles.badge}>📋 Booking Summary</span>
        <h3 style={styles.title}>Review Details</h3>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoItem}>
          <span style={styles.label}>🏢 Meeting Room</span>
          <span style={styles.value}>{roomName || 'Not selected'}</span>
        </div>

        <div style={styles.infoItem}>
          <span style={styles.label}>👥 Attendees</span>
          <span style={styles.value}>{peopleCount ? `${peopleCount} people` : 'Not specified'}</span>
        </div>

        <div style={styles.infoItem}>
          <span style={styles.label}>⏰ Time Slot</span>
          <span style={styles.value}>
            {startTimeStr ? `${formatTimeStr(startTimeStr)} - ${getEndTimeStr(startTimeStr, durationHours)}` : 'Not selected'}
          </span>
        </div>

        <div style={styles.infoItem}>
          <span style={styles.label}>⏳ Duration</span>
          <span style={styles.value}>{durationHours ? `${durationHours} hours` : 'Not specified'}</span>
        </div>

        <div style={styles.infoItem} className="full-width">
          <span style={styles.label}>📅 Date</span>
          <span style={styles.value}>Today, July 9, 2026</span>
        </div>
      </div>

      <div style={styles.btnRow}>
        <button 
          onClick={onConfirm} 
          style={styles.confirmBtn}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Confirm Booking
        </button>
        <button 
          onClick={onCancel} 
          style={styles.cancelBtn}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--panel-border)',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    margin: '12px 0',
    maxWidth: '400px'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: 'var(--accent-blue)',
    backgroundColor: 'var(--accent-blue-light)',
    padding: '3px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  title: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    padding: '12px 0',
    borderTop: '1px solid var(--panel-border)',
    borderBottom: '1px solid var(--panel-border)'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  value: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  btnRow: {
    display: 'flex',
    gap: '10px'
  },
  confirmBtn: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--accent-blue)',
    color: '#fff',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px 0 rgba(37, 99, 235, 0.2)',
    transition: 'all 0.2s ease'
  },
  cancelBtn: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: '1px solid var(--panel-border)',
    backgroundColor: '#ffffff',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
};

export default ConfirmationCard;
