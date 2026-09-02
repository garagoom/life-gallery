import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antTheme } from 'antd'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import './index.css'

function ThemedConfigProvider({ children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const antdTheme = useMemo(() => ({
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? '#b8a080' : '#8b7355',
      colorText: isDark ? '#e0e0e0' : '#4a4a4a',
      colorTextSecondary: isDark ? '#b8a080' : '#8b7355',
      colorBgContainer: isDark ? '#242424' : '#f5f0e8',
      colorBgLayout: isDark ? '#1a1a1a' : '#f5f0e8',
      colorBgElevated: isDark ? '#2a2a2a' : '#ffffff',
      colorBorder: isDark ? '#3a3a3a' : '#d4cdc1',
      colorBorderSecondary: isDark ? '#333' : '#e8e2d6',
      fontFamily: "'Playfair Display', serif",
      borderRadius: 8,
      colorLink: isDark ? '#b8a080' : '#8b7355',
      colorLinkHover: isDark ? '#d4b896' : '#a08060',
      controlItemBgActive: isDark ? '#333' : '#ebe5d9',
      controlItemBgHover: isDark ? '#2e2e2e' : '#f0ebe3',
    },
  }), [isDark]);

  return (
    <ConfigProvider theme={antdTheme}>
      {children}
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedConfigProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemedConfigProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
