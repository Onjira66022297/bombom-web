import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bombom_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('bombom_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login({ email, password });
    localStorage.setItem('bombom_token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('bombom_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
