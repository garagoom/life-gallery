import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getProfile, refreshToken as refreshAuthToken } from '../api/auth';
import { getAccessExpiresAt, ensureCsrf, redirectToLogin } from '../api/client';

const AuthContext = createContext(null);
const ACCESS_TTL_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  const scheduleNextRefresh = useCallback((handleRefresh) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const expiration = getAccessExpiresAt() || (Date.now() + ACCESS_TTL_MS);
    const refreshTime = expiration - Date.now() - 2 * 60 * 1000;

    if (refreshTime <= 0) {
      handleRefresh();
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      handleRefresh();
    }, refreshTime);
  }, []);

  const handleTokenRefresh = useCallback(async () => {
    try {
      const data = await refreshAuthToken();
      if (data?.user) setUser(data.user);
      scheduleNextRefresh(handleTokenRefresh);
    } catch (error) {
      console.error('Token refresh failed:', error);
      setUser(null);
      redirectToLogin(error?.reason === 'kicked' ? 'kicked' : 'expired');
    }
  }, [scheduleNextRefresh]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await ensureCsrf();
        const userData = await getProfile();
        if (userData) {
          setUser(userData);
          scheduleNextRefresh(handleTokenRefresh);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
        if (error?.reason === 'kicked' || error?.reason === 'expired') {
          redirectToLogin(error.reason);
        }
      }
      setLoading(false);
    };

    initAuth();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const loginUser = useCallback((userData) => {
    setUser(userData);
    scheduleNextRefresh(handleTokenRefresh);
  }, [scheduleNextRefresh, handleTokenRefresh]);

  const logoutUser = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    setUser(null);
  }, []);

  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles.includes(role);
    }
    return user.role === role;
  }, [user]);

  const can = useCallback((code) => {
    if (!user) return false;
    if (hasRole('admin')) return true;
    return Array.isArray(user.permissions) && user.permissions.includes(code);
  }, [user, hasRole]);

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, hasRole, can }}>
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
