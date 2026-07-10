import React from 'react';

const ROOM_METADATA = [
  { name: 'Zenith', capacity: 4, type: 'Cozy Space', color: '#0284c7' }, // Cyan-blue
  { name: 'Quantum', capacity: 8, type: 'Collaboration Room', color: '#2563eb' }, // Blue
  { name: 'Apex', capacity: 12, type: 'Executive Boardroom', color: '#4f46e5' }, // Indigo
  { name: 'Nova', capacity: 20, type: 'Presentation Space', color: '#7c3aed' } // Purple
];

const RoomDashboard = ({ bookings = [], onRoomSelect }) => {
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Group bookings by room
  const getBookingsForRoom = (roomName) => {
    return bookings.filter(b => b.roomName.toLowerCase() === roomName.toLowerCase());
  };

  // Check if room is currently occupied (based on current time)
  const isCurrentlyOccupied = (roomName) => {
    const roomBookings = getBookingsForRoom(roomName);
    const now = new Date().getTime();
    return roomBookings.some(b => {
      const start = new Date(b.startTime).getTime();
      const end = new Date(b.endTime).getTime();
      return now >= start && now <= end;
    });
  };

  return (
    <div style={styles.dashboardContainer} className="glass-panel room-dashboard-container">
      <div style={styles.header}>
        <h2 style={styles.title}>🏢 Room Status Board</h2>
        <p style={styles.subtitle}>Real-time availability for today (July 9, 2026)</p>
      </div>

      <div style={styles.grid}>
        {ROOM_METADATA.map(room => {
          const roomBookings = getBookingsForRoom(room.name);
          const occupied = isCurrentlyOccupied(room.name);

          return (
            <div 
              key={room.name} 
              className="glass-card" 
              style={{
                ...styles.card,
                borderLeft: `4px solid ${room.color}`
              }}
              onClick={() => onRoomSelect(room.name)}
            >
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.roomName}>{room.name}</h3>
                  <span style={styles.roomType}>{room.type}</span>
                </div>
                <div style={styles.statusBadgeContainer}>
                  <span style={{
                    ...styles.statusDot,
                    backgroundColor: occupied ? 'var(--danger)' : 'var(--success)',
                    boxShadow: occupied ? '0 0 6px var(--danger)' : '0 0 6px var(--success)'
                  }} />
                  <span style={{
                    ...styles.statusText,
                    color: occupied ? 'var(--danger-text)' : 'var(--success-text)'
                  }}>
                    {occupied ? 'Occupied' : 'Available'}
                  </span>
                </div>
              </div>

              <div style={styles.detailsRow}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Capacity</span>
                  <span style={styles.detailValue}>{room.capacity} seats</span>
                </div>
              </div>

              <div style={styles.bookingsSection}>
                <h4 style={styles.bookingsTitle}>Today's Schedule:</h4>
                {roomBookings.length === 0 ? (
                  <p style={styles.noBookings}>✨ No bookings today. Free to reserve!</p>
                ) : (
                  <div style={styles.bookingsList}>
                    {roomBookings.map((b, i) => (
                      <div key={i} style={styles.bookingSlot}>
                        <div style={styles.bookingTime}>
                          {formatTime(b.startTime)} - {formatTime(b.endTime)}
                        </div>
                        <div style={styles.bookingMeta}>
                          {b.peopleCount} guests
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  dashboardContainer: {
    padding: '24px',
    flex: '1 1 350px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
    overflowY: 'auto'
  },
  header: {
    marginBottom: '20px',
    borderBottom: '1px solid var(--panel-border)',
    paddingBottom: '12px'
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px'
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)'
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  card: {
    padding: '16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: '#ffffff'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  roomName: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  roomType: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  statusBadgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  detailsRow: {
    display: 'flex',
    gap: '16px',
    borderBottom: '1px solid var(--panel-border)',
    paddingBottom: '10px'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  detailLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  detailValue: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-primary)'
  },
  bookingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  bookingsTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  noBookings: {
    fontSize: '0.8rem',
    color: '#059669', // Emerald-600
    fontStyle: 'italic',
    padding: '4px 0'
  },
  bookingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  bookingSlot: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--accent-blue-light)',
    border: '1px solid rgba(37, 99, 235, 0.1)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '0.8rem'
  },
  bookingTime: {
    color: 'var(--accent-blue-dark)',
    fontWeight: '600'
  },
  bookingMeta: {
    color: 'var(--text-secondary)'
  }
};

export default RoomDashboard;
