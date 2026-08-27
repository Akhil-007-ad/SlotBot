import React, { useCallback, useEffect, useState } from 'react'
import Loading from '../components/Loading';

const HistoryPage = ({ apiFetch, currentUser }) => {
  const [view, setView] = useState('overall');
  const [mode, setMode] = useState('all');
  const [data, setData] = useState({ bookings: [], pagination: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [cancellingId, setCancellingId] = useState(null);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const scope = view === 'overall' ? 'all' : view;
      const response = await apiFetch(`/api/bookings/history?mode=${view === 'overall' ? mode : 'all'}&scope=${scope}&page=${page}&limit=${view === 'overall' ? 50 : 100}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load booking history.');
      setData(result);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [apiFetch, mode, page, view]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadHistory(true), 10000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  const cancelBooking = async booking => {
    if (!window.confirm(`Cancel the ${booking.roomName} meeting?`)) return;
    setCancellingId(booking.id);
    try {
      const response = await apiFetch(`/api/bookings/${booking.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to cancel this meeting.');
      setData(current => ({
        ...current,
        bookings: current.bookings.map(item => item.id === booking.id ? { ...item, status: 'cancelled', canCancel: false } : item)
      }));
      setError('');
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setCancellingId(null);
    }
  };

  const selectMode = event => {
    setMode(event.target.value);
    setPage(1);
  };

  const selectView = nextView => {
    setView(nextView);
    setPage(1);
  };
  if(loading){
    return(<Loading/>)
  }


  return (
    <main className="flex-1 p-5">
      <section className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-violet-900">Booking History</h2>
            <p className="mt-1 text-sm text-slate-500">Most recent bookings appear first.</p>
          </div>
          {view === 'overall' && <select value={mode} onChange={selectMode} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <option value="all">All Bookings</option>
            <option value="bookedBy">Booked by Me</option>
            <option value="included">Included Me</option>
          </select>}
        </div>
        {currentUser?.isAdmin && <div className="mb-6 flex gap-2 border-b border-slate-200">
          {[['overall', 'Overall History'], ['today', "Today's Meetings"], ['future', 'Future Meetings']].map(([key, label]) => (
            <button key={key} onClick={() => selectView(key)} className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${view === key ? 'border-violet-700 text-violet-700' : 'border-transparent text-slate-500 hover:text-violet-600'}`}>{label}</button>
          ))}
        </div>}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {view === 'overall' && <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">Room</th><th className="px-3 py-3">Organizer</th><th className="px-3 py-3">People</th><th className="px-3 py-3">Attendees</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && data.bookings.map(booking => (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-4">{new Date(booking.startTime).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-3 py-4">{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-4 font-semibold text-slate-800">{booking.roomName}</td>
                  <td className="px-3 py-4"><div>{booking.organizer.name || 'Unknown'}</div><div className="text-xs text-slate-500">{booking.organizer.email}</div></td>
                  <td className="px-3 py-4">{booking.peopleCount}</td>
                  <td className="max-w-xs px-3 py-4 text-xs text-slate-600">{booking.attendees.join(', ') || '—'}</td>
                  <td className="px-3 py-4 capitalize">{booking.status}</td>
                  <td className="px-3 py-4">{booking.canCancel ? <button onClick={() => cancelBooking(booking)} disabled={cancellingId === booking.id} className="whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{cancellingId === booking.id ? 'Cancelling…' : 'Cancel'}</button> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
        {['today', 'future'].includes(view) && !loading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.bookings.map(booking => <MeetingCard key={booking.id} booking={booking} currentTime={currentTime} showDate={view === 'future'} onCancel={cancelBooking} cancelling={cancellingId === booking.id}/>) }
        </div>}
        {loading && <p className="py-10 text-center text-slate-500">Loading history…</p>}
        {!loading && !data.bookings.length && !error && <p className="py-10 text-center text-slate-500">No bookings found.</p>}
        {view === 'overall' && <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <span>{data.pagination.total || 0} booking(s)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={page >= (data.pagination.pages || 1)} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>}
      </section>
    </main>
  )
}

const MeetingCard = ({ booking, currentTime, showDate, onCancel, cancelling }) => {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const isCancelled = booking.status === 'cancelled';
  const timingStatus = isCancelled
    ? { label: 'Cancelled', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300' }
    : currentTime >= end.getTime()
      ? { label: 'Done', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' }
      : currentTime >= start.getTime()
        ? { label: 'Ongoing', badge: 'bg-orange-50 text-orange-700', bar: 'bg-orange-500' }
        : { label: 'Upcoming', badge: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500' };
  return <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isCancelled ? 'border-slate-200 opacity-70' : 'border-violet-100'}`}>
    <div className={`h-1.5 ${timingStatus.bar}`}/>
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Meeting room</p><h3 className="mt-1 text-xl font-bold text-slate-900">{booking.roomName}</h3></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${timingStatus.badge}`}>{timingStatus.label}</span>
      </div>
      <div className="space-y-3 text-sm">
        {showDate && <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3"><span className="text-lg">📅</span><div><p className="text-xs text-blue-600">Date</p><p className="font-semibold text-blue-900">{start.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p></div></div>}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="text-lg">🕒</span><div><p className="text-xs text-slate-500">Time</p><p className="font-semibold text-slate-800">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>
        <div className="flex items-center gap-3"><span className="text-lg">👤</span><div><p className="text-xs text-slate-500">Organizer</p><p className="font-semibold text-slate-800">{booking.organizer.name || booking.organizer.email || 'Unknown'}</p></div></div>
        <div className="flex items-center gap-3"><span className="text-lg">👥</span><div><p className="text-xs text-slate-500">Attendees</p><p className="font-semibold text-slate-800">{booking.peopleCount} people</p></div></div>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Members</p>
        <div className="flex flex-wrap gap-1.5">
          {booking.attendees.length
            ? booking.attendees.map(attendee => <span key={attendee} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">{attendee}</span>)
            : <span className="text-xs text-slate-500">No attendee details</span>}
        </div>
      </div>
      {booking.canCancel && <button onClick={() => onCancel(booking)} disabled={cancelling} className="mt-4 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Cancel Meeting'}</button>}
    </div>
  </article>;
};

export default HistoryPage
