import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('onam_user_data');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('onam_auth_token') || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const res = await api.get('/me');
      setUser(res.data);
      localStorage.setItem('onam_user_data', JSON.stringify(res.data));
    } catch (err) {
      console.error('Failed to fetch user:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loginWithToken = (access_token, user_data) => {
    setToken(access_token);
    setUser(user_data);
    localStorage.setItem('onam_auth_token', access_token);
    localStorage.setItem('onam_user_data', JSON.stringify(user_data));
  };

  const devLogin = async (phone, name, role, roll_no = '') => {
    setLoading(true);
    try {
      const res = await api.post('/auth/dev-login', {
        phone,
        name,
        role,
        roll_no
      });
      loginWithToken(res.data.access_token, res.data.user);
      return res.data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('onam_auth_token');
    localStorage.removeItem('onam_user_data');
  };

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginWithToken,
      devLogin,
      logout,
      fetchCurrentUser,
      isStudent,
      isAdmin,
      isSuperAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
