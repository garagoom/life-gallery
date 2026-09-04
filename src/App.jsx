import { lazy, Suspense, useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import FloatingMenu from './components/FloatingMenu';
import HomePage from './components/HomePage';
import RetroLightbox from './components/RetroLightbox';
import Loading from './components/Loading';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { fallbackPhotos } from './data/photos';

const Portfolio = lazy(() => import('./components/Portfolio'));
const PhotoDetail = lazy(() => import('./components/PhotoDetail'));
const Admin = lazy(() => import('./components/Admin'));
const ReviewManage = lazy(() => import('./components/ReviewManage'));
const UserManage = lazy(() => import('./components/UserManage'));
const RoleManage = lazy(() => import('./components/RoleManage'));
const MenuManage = lazy(() => import('./components/MenuManage'));
const Profile = lazy(() => import('./components/Profile'));
const Register = lazy(() => import('./components/Register'));

const hideMenuPaths = ['/login', '/register', '/loading'];

function RouteFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}>
      <Spin size="large" />
    </div>
  );
}

function FloatingMenuWrapper() {
  const { pathname } = useLocation();
  if (hideMenuPaths.some(p => pathname.startsWith(p))) return null;
  return <FloatingMenu />;
}

function AppRoutes({ handlePhotosLoaded, handlePhotoClick, isPaused, photos }) {
  const location = useLocation();
  const background = location.state?.background;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes location={background || location}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/loading" element={<Loading onPhotosLoaded={handlePhotosLoaded} />} />

        <Route path="/photography/home" element={
          <ProtectedRoute>
            <HomePage
              onPhotoClick={handlePhotoClick}
              isPaused={isPaused}
              initialPhotos={photos}
            />
          </ProtectedRoute>
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
              <PhotoDetail />
            </div>
          </ProtectedRoute>
        } />
        <Route path="/photography/admin" element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/photography/admin/review" element={
          <ProtectedRoute>
            <ReviewManage />
          </ProtectedRoute>
        } />
        <Route path="/photography/admin/users" element={
          <ProtectedRoute>
            <UserManage />
          </ProtectedRoute>
        } />
        <Route path="/photography/admin/roles" element={
          <ProtectedRoute>
            <RoleManage />
          </ProtectedRoute>
        } />
        <Route path="/photography/admin/menus" element={
          <ProtectedRoute>
            <MenuManage />
          </ProtectedRoute>
        } />
        <Route path="/photography/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/photography/home" replace />} />
        <Route path="/photography" element={<Navigate to="/photography/home" replace />} />
        <Route path="*" element={<Navigate to="/photography/home" replace />} />
      </Routes>

      {background && (
        <Routes>
          <Route path="/photography/photo/:id" element={
            <ProtectedRoute>
              <PhotoDetail overlay />
            </ProtectedRoute>
          } />
        </Routes>
      )}
    </Suspense>
  );
}

function initPhotos() {
  try {
    const cached = sessionStorage.getItem('preloadedPhotos');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.length > 0) return { photos: parsed, loaded: true };
    }
  } catch {}
  return { photos: fallbackPhotos, loaded: false };
}

function App() {
  const init = useRef(initPhotos());
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [photos, setPhotos] = useState(init.current.photos);

  const handlePhotosLoaded = useCallback((loadedPhotos) => {
    if (loadedPhotos && loadedPhotos.length > 0) {
      setPhotos(loadedPhotos);
    }
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
    <BrowserRouter>
      <div style={{ height: '100%' }}>
        <AppRoutes
          handlePhotosLoaded={handlePhotosLoaded}
          handlePhotoClick={handlePhotoClick}
          isPaused={isPaused}
          photos={photos}
        />

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
  );
}

export default App;
