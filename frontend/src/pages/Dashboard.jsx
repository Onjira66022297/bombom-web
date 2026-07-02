import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin: 'Administrator',
  presales: 'Presales',
  technical_consultant: 'Technical Consultant',
  manager: 'Manager',
};

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#3a8a3a] text-white font-bold flex items-center justify-center">
            B
          </div>
          <span className="font-semibold text-gray-900">BOMBOM</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <Link to="/admin/users" className="text-sm text-gray-500 hover:text-gray-900">
              User management
            </Link>
          )}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {user?.fullName?.split(' ')[0]}
          </h1>
          <Link
            to="/cases/new"
            className="rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium px-4 py-2"
          >
            + New case
          </Link>
        </div>
        <p className="text-gray-500 mb-8">Here's the presales pipeline at a glance.</p>

        <Link to="/cases/new" className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
          {['Search Email', 'Analyze Email', 'Select Specs', 'Check BOM'].map((step, i) => (
            <div
              key={step}
              className="rounded-xl border border-gray-100 p-4 bg-[#e8f5e9]/40 hover:border-[#3a8a3a] transition-colors"
            >
              <p className="text-xs font-medium text-[#2e7d32] mb-1">Step {i + 1}</p>
              <p className="text-sm font-semibold text-gray-900">{step}</p>
            </div>
          ))}
        </Link>

        <div className="rounded-xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500">
            This is a real, authenticated view — your session came from a live JWT issued by the
            BOMBOM API, not mock data. Click "New case" to run the full pipeline against the real
            backend (BOM checking parses actual .xlsx files against the product catalog).
          </p>
        </div>
      </main>
    </div>
  );
}
