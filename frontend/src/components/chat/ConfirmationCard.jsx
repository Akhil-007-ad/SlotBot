import React from 'react';

const ConfirmationCard = ({ bookingData, onConfirm, onCancel }) => {
  const { selectedRoomName, attendeeCount, date, startTime, endTime, tvRequired, participants, subject, description } = bookingData;

  const formatTimeStr = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = value => {
    if (!value) return 'Not selected';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDuration = () => {
    if (!startTime || !endTime) return 'Not selected';
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (minutes <= 0) return 'Not selected';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return [hours ? `${hours} hr${hours === 1 ? '' : 's'}` : '', remainingMinutes ? `${remainingMinutes} min` : ''].filter(Boolean).join(' ');
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)] my-3 max-w-[400px]">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="self-start text-[0.7rem] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wide">
          📋 Booking Summary
        </span>
        <h3 className="text-base font-bold text-slate-900">Review Details</h3>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-slate-200">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">🏢 Meeting Room</span>
          <span className="text-sm font-semibold text-slate-900">{selectedRoomName || 'Not selected'}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">👥 Attendees</span>
          <span className="text-sm font-semibold text-slate-900">{attendeeCount ? `${attendeeCount} people` : 'Not specified'}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">⏰ Time Slot</span>
          <span className="text-sm font-semibold text-slate-900">
            {startTime ? `${formatTimeStr(startTime)} – ${formatTimeStr(endTime)}` : 'Not selected'}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">⏳ Duration</span>
          <span className="text-sm font-semibold text-slate-900">{getDuration()}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">📅 Date</span>
          <span className="text-sm font-semibold text-slate-900">{formatDate(date)}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">🖥 Display</span>
          <span className="text-sm font-semibold text-slate-900">{tvRequired ? 'TV required' : 'No TV required'}</span>
        </div>

        <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">👥 Members Invited</span>
          <span className="text-sm font-semibold text-slate-900 break-all">{participants?.length ? participants.join(', ') : 'None'}</span>
        </div>
        <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">✉️ Email Title</span>
          <span className="text-sm font-semibold text-slate-900">{subject || 'Not specified'}</span>
        </div>
        <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">📝 Agenda</span>
          <span className="text-sm text-slate-700 whitespace-pre-wrap">{description || 'None'}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5">
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-semibold text-sm cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700"
        >
          Confirm Booking
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 rounded-lg border border-slate-200 bg-white text-slate-500 font-medium text-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ConfirmationCard;
