'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  phone: string | null;
  isAuthenticated: boolean;
  login: (phone: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('jeevan_citizen_token');
      const storedPhone = localStorage.getItem('jeevan_citizen_phone');
      if (storedToken && storedPhone) {
        setToken(storedToken);
        setPhone(storedPhone);
      }
    } catch (e) {
      console.error('Error reading localStorage for authentication details', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (newPhone: string, newToken: string) => {
    setToken(newToken);
    setPhone(newPhone);
    try {
      localStorage.setItem('jeevan_citizen_token', newToken);
      localStorage.setItem('jeevan_citizen_phone', newPhone);
    } catch (e) {
      console.error('Failed to save credentials to localStorage', e);
    }
  };

  const logout = () => {
    setToken(null);
    setPhone(null);
    try {
      localStorage.removeItem('jeevan_citizen_token');
      localStorage.removeItem('jeevan_citizen_phone');
    } catch (e) {
      console.error('Failed to clear credentials from storage', e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        <p>Loading application state...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ token, phone, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
