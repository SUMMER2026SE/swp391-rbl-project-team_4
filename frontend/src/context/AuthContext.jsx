import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage/sessionStorage on mount
    const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user from storage', e);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData, tokenValue, remember = false) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', tokenValue);
    storage.setItem('user', JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('bookingSessionId');
    sessionStorage.removeItem('booking');
    localStorage.removeItem('booking');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.Role === 'Admin' || user?.role === 'Admin';
  const isStaff = user?.Role === 'Staff' || user?.role === 'Staff';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
