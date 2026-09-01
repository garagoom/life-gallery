import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const theme = {
  token: {
    colorPrimary: '#8b7355',
    colorText: '#4a4a4a',
    colorTextSecondary: '#8b7355',
    colorBgContainer: '#f5f0e8',
    colorBgLayout: '#f5f0e8',
    colorBorder: '#d4cdc1',
    fontFamily: "'Playfair Display', serif",
    borderRadius: 8,
  },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>,
)
