import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AdminUsers() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, allRes] = await Promise.all([api.listUsers('pending'), api.listUsers()]);
      setPending(pendingRes.users);
      setAllUsers(allRes.users);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      if (action === 'approve') await api.approveUser(id);
      else await api.rejectUser(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        This page is only available to administrators.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#3a8a3a] text-white font-bold flex items-center justify-center">B</div>
          <span className="font-semibold text-gray-900">BOMBOM</span>
        </div>
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Back to dashboard</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">User management</h1>
        <p className="text-gray-500 mb-8">Approve pending registrations and manage access.</p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-6">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Pending approval {pending.length > 0 && `(${pending.length})`}
          </h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-400">No accounts waiting for approval.</p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {pending.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === u.id}
                      onClick={() => act(u.id, 'approve')}
                      className="text-xs font-medium rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white px-3 py-1.5 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busyId === u.id}
                      onClick={() => act(u.id, 'reject')}
                      className="text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All users</h2>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {allUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                  <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    u.status === 'active'
                      ? 'bg-[#e8f5e9] text-[#2e7d32]'
                      : u.status === 'pending'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {u.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
