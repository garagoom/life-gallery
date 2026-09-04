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
    const roleHierarchy = { admin: 4, module_admin: 3, creator: 2, viewer: 1 };
    return (roleHierarchy[user.role] || 0) >= (roleHierarchy[role] || 0);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, hasRole }}>
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
