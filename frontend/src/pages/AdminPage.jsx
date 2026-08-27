import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading';

const AdminPage = ({ apiFetch }) => {
  const [view, setView] = useState('admins');
  const [adminEmail, setAdminEmail] = useState('');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [sort, setSort] = useState({ key: 'organizerCount', direction: 'desc' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await apiFetch('/api/admin/users');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load administrators.');
      setUsers(data.users);
      setError('');
    } catch (loadError) { setError(loadError.message); }
    finally { setUsersLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const addAdmin = async event => {
    event.preventDefault();
    try {
      const response = await apiFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add administrator.');
      setAdminEmail('');
      setNotice(`Administrator access granted to ${data.user.email}.`);
      setError('');
      await loadUsers();
    } catch (updateError) { setError(updateError.message); }
  };

  const removeAdmin = async user => {
    try {
      const response = await apiFetch(`/api/admin/admins/${encodeURIComponent(user.email)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to remove administrator.');
      setNotice(`Administrator access removed from ${user.email}.`);
      setError('');
      await loadUsers();
    } catch (updateError) { setError(updateError.message); }
  };

  const loadReport = useCallback(async () => {
    const [year, selectedMonth] = month.split('-');
    try {
      const response = await apiFetch(`/api/admin/reports/monthly?month=${Number(selectedMonth)}&year=${year}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load monthly report.');
      setReport(data);
      setError('');
    } catch (loadError) { setError(loadError.message); }
  }, [apiFetch, month]);

  useEffect(() => { if (view === 'report') loadReport(); }, [view, loadReport]);

  const sortedUsers = useMemo(() => {
    const rows = [...(report?.users || [])];
    return rows.sort((left, right) => {
      const result = typeof left[sort.key] === 'string'
        ? left[sort.key].localeCompare(right[sort.key])
        : left[sort.key] - right[sort.key];
      return sort.direction === 'asc' ? result : -result;
    });
  }, [report, sort]);

  const changeSort = key => setSort(current => ({
    key,
    direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
  }));
  if(usersLoading){
    return(<Loading/>)
  }

  return (
    <main className="flex-1 p-5">
      <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-violet-900">Administration</h2>
        <div className="my-6 flex gap-2 border-b border-slate-200">
          {[['admins', 'Manage Admins'], ['report', 'Monthly Report']].map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${view === key ? 'border-violet-700 text-violet-700' : 'border-transparent text-slate-500'}`}>{label}</button>
          ))}
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">{notice}</p>}

        {view === 'admins' && <>
          <form onSubmit={addAdmin} className="mb-5 flex gap-2">
            <input type="email" required value={adminEmail} onChange={event => setAdminEmail(event.target.value)} placeholder="person@techwave.com" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">Add Admin</button>
          </form>
          {usersLoading ? <p className="py-8 text-center text-slate-500">Loading users…</p> : <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {users.map(user => <div key={user.email || user.entraId || user._id} className="flex items-center justify-between gap-4 p-4">
              <div><p className="font-semibold text-slate-800">{user.name || 'Unnamed user'}</p><p className="text-sm text-slate-500">{user.email}{user.department ? ` · ${user.department}` : ''}</p></div>
              <button disabled={!user.email} onClick={() => removeAdmin(user)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Remove Admin</button>
            </div>)}
            {!users.length && <p className="p-6 text-center text-slate-500">No users found.</p>}
          </div>}
        </>}

        {view === 'report' && <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <input type="month" value={month} onChange={event => setMonth(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="rounded-xl bg-violet-50 px-5 py-3"><span className="text-sm text-violet-700">Total bookings</span><strong className="ml-3 text-2xl text-violet-900">{report?.totalBookings ?? '—'}</strong></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <SortableHeader label="User" sortKey="name" onSort={changeSort}/><SortableHeader label="Email" sortKey="email" onSort={changeSort}/><SortableHeader label="Booked" sortKey="organizerCount" onSort={changeSort}/><SortableHeader label="Included" sortKey="includedCount" onSort={changeSort}/>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{sortedUsers.map(user => <tr key={user.id}><td className="px-4 py-3 font-medium">{user.name}</td><td className="px-4 py-3 text-slate-500">{user.email || '—'}</td><td className="px-4 py-3">{user.organizerCount}</td><td className="px-4 py-3">{user.includedCount}</td></tr>)}</tbody>
            </table>
          </div>
        </>}
      </section>
    </main>
  )
}

const SortableHeader = ({ label, sortKey, onSort }) => <th className="px-4 py-3"><button onClick={() => onSort(sortKey)} className="font-semibold hover:text-violet-700">{label} ↕</button></th>;

export default AdminPage
