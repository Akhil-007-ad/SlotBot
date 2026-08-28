import { FaCalendarAlt } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { BsFillPeopleFill } from "react-icons/bs";
import { FaClock } from "react-icons/fa6";

import { GoInfo } from "react-icons/go";
import { useState } from "react";

const RoomDashboard = ({ rooms = [], bookings = { today: [], tomorrow: [] }, onRoomSelect, loading }) => {
  const [selectedDay, setSelectedDay] = useState('today');
  const selectedBookings = bookings[selectedDay] || [];
  const selectedDate = new Date();
  if (selectedDay === 'tomorrow') selectedDate.setDate(selectedDate.getDate() + 1);
  const formatTime = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const roomBookings = roomName => selectedBookings.filter(booking => booking.roomName.toLowerCase() === roomName.toLowerCase());
  const isOccupied = roomName => roomBookings(roomName).some(booking => {
    if (selectedDay !== 'today') return false;
    const now = Date.now();
    return now >= new Date(booking.startTime).getTime() && now <= new Date(booking.endTime).getTime();
  });

  return (
    <section className="flex flex-col h-[calc(100vh-110px)] border-2 border-slate-200/70 rounded-2xl p-3">
      {/* Header */}
      <header className="mb-4 shrink-0">
        <h2 className="text-base font-bold text-slate-900">🏢 Room Status Board</h2>
        <p className="text-slate-500 text-[0.85rem] mt-1">
          Room details and bookings for {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        <div className="mt-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {['today', 'tomorrow'].map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${selectedDay === day ? 'bg-violet-700 text-white shadow-sm' : 'text-slate-600 hover:text-violet-700'}`}
            >
              {day}
            </button>
          ))}
        </div>
      </header>
      {loading && <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-700"></div>
        <p className="text-slate-500 ml-2">Refreshing rooms…</p>
      </div>}
      {!loading && !rooms.length && <div className="flex-1 flex items-center justify-center"><p className="text-slate-500">No rooms available.</p></div>}
      {/* Room cards grid */}
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
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
              <div className="flex justify-between">
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
                  <span className="text-[0.8rem] text-slate-500 flex justify-center gap-1 items-center font-semibold"><FaLocationDot size={15}/>{room.floor} · {room.location} ·{room.roomType}</span>
                  {room.hasPrivilegeToBookAWeekPrior && <span className="w-fit rounded-full bg-violet-100 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-violet-800">Admin only</span>}
                </div>
                <strong className={occupied ? "text-red-700 text-[0.78rem] shrink-0" : "text-emerald-700 text-[0.78rem] shrink-0"}>
                  {occupied ? '● Currently Occupied' : selectedDay === 'today' ? '● Currently Available' : '● Available tomorrow'}
                </strong>
              </div>

              {/* Capacity / features */}
              <p className="text-slate-500 text-sm my-2.5 flex items-center">
                <span className='font-semibold text-slate-500 flex items-center gap-1'><BsFillPeopleFill size={17}/>{room.sittingCapacity} seats</span> 
                {room.tvAvailability ?<span className='text-green-800 font-semibold'>· TV available</span> :<span className='text-red-800 font-semibold'>· TV not available</span>}
              </p>

              <p className="text-slate-500 flex items-center gap-1 font-semibold text-[0.8rem] my-2.5">
                <FaClock/>You can book from a minimum of half an hour to {room.maxBookingHours} hours
              </p>

              {/* Schedule */}
              <div className="text-[0.78rem] py-2 space-y-1.5">
                {schedule.length
                  ? schedule.map(booking => (
                    <div key={booking._id} className="text-red-900 flex justify-start gap-2 p-2 items-center bg-red-500/10 rounded-lg">
                      <FaCalendarAlt/>
                      <b>{formatTime(booking.startTime)} – {formatTime(booking.endTime)} · Slot booked</b>
                    </div>
                  ))
                  : <div className="bg-blue-50 p-2 rounded-md text-slate-600 font-semibold">No bookings {selectedDay}</div>}
              </div>

              <div className="text-xs flex items-center gap-2 p-2 bg-orange-700/10 text-orange-800/80 font-semibold rounded-md">
                <GoInfo size={15}/>
                {schedule.length?'Remaining slots are available.':""}Please book only if necessary.
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default RoomDashboard;
