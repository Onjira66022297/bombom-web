import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-[#3a8a3a]'];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'presales' });
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.register(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f5e9] text-[#2e7d32] text-2xl mb-4">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Registration submitted</h1>
          <p className="text-sm text-gray-500 mb-6">
            An administrator needs to approve your account before you can sign in. You'll be notified once it's active.
          </p>
          <Link to="/login" className="text-[#3a8a3a] font-medium text-sm hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3a8a3a] text-white font-bold text-lg mb-4">
            B
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Requires administrator approval before activation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              required
              value={form.fullName}
              onChange={handleChange('fullName')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={handleChange('email')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={handleChange('role')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
            >
              <option value="presales">Presales</option>
              <option value="technical_consultant">Technical Consultant</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange('password')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
            />
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < strength ? STRENGTH_COLORS[strength] : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{STRENGTH_LABELS[strength]}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Register'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#3a8a3a] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
