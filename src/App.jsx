import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import FloatingMenu from './components/FloatingMenu';
import HomePage from './components/HomePage';
import Portfolio from './components/Portfolio';
import RetroLightbox from './components/RetroLightbox';
import Admin from './components/Admin';
import Loading from './components/Loading';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import UserManage from './components/UserManage';
import RoleManage from './components/RoleManage';
import MenuManage from './components/MenuManage';
import Profile from './components/Profile';
import PhotoDetail from './components/PhotoDetail';
import { fallbackPhotos } from './data/photos';
import { getRandomPhotos } from './api/photos';
import { ThemeProvider } from './contexts/ThemeContext';

const hideMenuPaths = ['/login', '/register', '/loading'];

function FloatingMenuWrapper() {
  const { pathname } = useLocation();
  if (hideMenuPaths.some(p => pathname.startsWith(p))) return null;
  return <FloatingMenu />;
}

function App() {
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [photos, setPhotos] = useState(fallbackPhotos);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const loadInitiated = useRef(false);

  const handlePhotosLoaded = useCallback((loadedPhotos) => {
    if (loadedPhotos && loadedPhotos.length > 0) {
      setPhotos(loadedPhotos);
    }
    setPhotosLoaded(true);
  }, []);

  const handlePhotoClick = useCallback((photo) => {
    setLightboxPhoto(photo);
    setIsPaused(true);
  }, []);

  const handleNavigate = useCallback((direction) => {
    setLightboxPhoto((current) => {
      if (!current) return null;
      const idx = photos.findIndex(p => p.id === current.id);
      const newIdx = direction === 'next'
        ? (idx + 1) % photos.length
        : (idx - 1 + photos.length) % photos.length;
      return photos[newIdx];
    });
  }, [photos]);

  const handleCloseLightbox = useCallback(() => {
    setLightboxPhoto(null);
    setIsPaused(false);
  }, []);

  return (
    <ThemeProvider>
    <BrowserRouter>
      <div style={{ height: '100%' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/loading" element={<Loading onPhotosLoaded={handlePhotosLoaded} />} />

          <Route path="/photography/home" element={
            photosLoaded ? (
              <ProtectedRoute>
                <HomePage
                  onPhotoClick={handlePhotoClick}
                  isPaused={isPaused}
                  initialPhotos={photos}
                />
              </ProtectedRoute>
            ) : (
              <Navigate to="/loading" replace />
            )
          } />
          <Route path="/photography/portfolio" element={
            <ProtectedRoute>
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <Portfolio />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/photo/:id" element={
            <ProtectedRoute>
              <div style={{ height: '100%', overflow: 'auto' }}>
                <PhotoDetail photos={photos} />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/admin" element={
            <ProtectedRoute requiredRole="editor">
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <Admin />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/admin/users" element={
            <ProtectedRoute requiredRole="admin">
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <UserManage />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/admin/roles" element={
            <ProtectedRoute requiredRole="admin">
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <RoleManage />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/admin/menus" element={
            <ProtectedRoute requiredRole="admin">
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <MenuManage />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/photography/profile" element={
            <ProtectedRoute>
              <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
                <Profile />
              </div>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/loading" replace />} />
          <Route path="/photography" element={<Navigate to="/loading" replace />} />
          <Route path="*" element={<Navigate to="/loading" replace />} />
        </Routes>

        <FloatingMenuWrapper />

        {lightboxPhoto && (
          <RetroLightbox
            photo={lightboxPhoto}
            photos={photos}
            onClose={handleCloseLightbox}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
