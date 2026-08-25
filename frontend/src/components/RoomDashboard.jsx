import React from 'react';

const RoomDashboard = ({ rooms = [], bookings = [], onRoomSelect }) => {
  const formatTime = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const roomBookings = roomName => bookings.filter(booking => booking.roomName.toLowerCase() === roomName.toLowerCase());
  const isOccupied = roomName => roomBookings(roomName).some(booking => {
    const now = Date.now();
    return now >= new Date(booking.startTime).getTime() && now <= new Date(booking.endTime).getTime();
  });

  return (
    <section className="flex flex-col h-[85vh] border-2 border-slate-200/70 rounded-2xl p-3">
      {/* Header */}
      <header className="mb-4 shrink-0">
        <h2 className="text-base font-bold text-slate-900">🏢 Room Status Board</h2>
        <p className="text-slate-500 text-[0.85rem] mt-1">
          Live availability for {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </header>

      {/* Room cards grid */}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[72vh] pr-1">
        {rooms.map(room => {
          const schedule = roomBookings(room.name);
          const occupied = isOccupied(room.name);
          return (
            <button
              key={room._id || room.name}
              type="button"
              onClick={() => onRoomSelect(room.name)}
              className="appearance-none border border-slate-200 rounded-xl bg-white text-left font-[inherit] p-3.5 cursor-pointer transition-all duration-200 hover:border-blue-500 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)]"
            >
              {/* Top row */}
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{room.name}</h3>
                  <span className="text-slate-500 text-[0.8rem]">{room.floor} · {room.roomType}</span>
                </div>
                <strong className={occupied ? "text-red-700 text-[0.78rem]" : "text-emerald-700 text-[0.78rem]"}>
                  {occupied ? '● Occupied' : '● Available'}
                </strong>
              </div>

              {/* Capacity / features */}
              <p className="text-slate-500 text-[0.8rem] my-2.5">
                {room.sittingCapacity} seats
                {room.tvAvailability ? ' · TV available' : ''}
                {room.authorizedRoles?.[0] !== 'Everyone' ? ' · Restricted' : ''}
              </p>

              {/* Schedule */}
              <div className="bg-blue-50 rounded-md text-slate-500 text-[0.78rem] p-2 space-y-1">
                {schedule.length
                  ? schedule.map(booking => (
                    <div key={booking._id}>
                      <b>{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</b> · {booking.peopleCount} guests
                    </div>
                  ))
                  : 'No bookings today'}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default RoomDashboard;
