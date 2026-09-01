import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { isAuthenticated, getProfile, getRefreshToken, getTokenExpiration, refreshToken as refreshAuthToken } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  const handleTokenRefresh = useCallback(async () => {
    try {
      const refreshTokenValue = getRefreshToken();
      if (!refreshTokenValue) {
        setUser(null);
        return;
      }

      await refreshAuthToken(refreshTokenValue);
      // Schedule next refresh after successful refresh
      scheduleNextRefresh();
    } catch (error) {
      console.error('Token refresh failed:', error);
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const scheduleNextRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const expiration = getTokenExpiration();
    if (!expiration) return;

    // Refresh token 2 minutes before expiration
    const refreshTime = expiration - Date.now() - 2 * 60 * 1000;
    
    if (refreshTime <= 0) {
      // Token is already expired or about to expire, refresh immediately
      handleTokenRefresh();
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      handleTokenRefresh();
    }, refreshTime);
  }, [handleTokenRefresh]);

  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        try {
          // Check if token is expired
          if (getTokenExpiration() && Date.now() >= getTokenExpiration() - 30000) {
            // Token is expired, try to refresh
            await handleTokenRefresh();
          } else {
            // Token is valid, get profile
            const userData = await getProfile();
            setUser(userData);
            // Schedule refresh
            scheduleNextRefresh();
          }
        } catch {
          setUser(null);
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
  }, []); // Empty dependency array - only run on mount

  const loginUser = useCallback((userData) => {
    setUser(userData);
    // Schedule token refresh after login
    scheduleNextRefresh();
  }, [scheduleNextRefresh]);

  const logoutUser = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    setUser(null);
  }, []);

  const hasRole = useCallback((role) => {
    if (!user) return false;
    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
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
