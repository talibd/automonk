import { useState, useCallback } from 'react';
import { login as apiLogin } from '../lib/api';

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [role,  setRole]  = useState(() => localStorage.getItem('role') || 'operator');

  const login = useCallback(async (password) => {
    const data = await apiLogin(password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role || 'operator');
    setToken(data.token);
    setRole(data.role || 'operator');
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole(null);
  }, []);

  return { token, role, isAuthenticated: !!token, login, logout };
}
