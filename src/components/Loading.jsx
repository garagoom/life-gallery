import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Progress } from 'antd';
import { getRandomPhotos } from '../api/photos';
import { getPhotoUrl } from '../data/photos';
import { fallbackPhotos } from '../data/photos';

export default function Loading({ onPhotosLoaded }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在连接服务器...');
  const navigate = useNavigate();
  const loadInitiated = useRef(false);

  useEffect(() => {
    if (loadInitiated.current) return;
    loadInitiated.current = true;

    const loadAndPreload = async () => {
      try {
        // Phase 1: Fetch photo list
        setStatus('正在获取图片列表...');
        setProgress(10);

        const result = await getRandomPhotos(20);
        const photos = result.data || [];

        if (photos.length === 0) {
          // No photos from server, use fallback
          setProgress(100);
          setStatus('使用默认图片...');
          if (onPhotosLoaded) onPhotosLoaded(fallbackPhotos);
          navigate('/photography/home', { replace: true });
          return;
        }

        setProgress(30);
        setStatus(`正在加载 ${photos.length} 张图片...`);

        // Phase 2: Preload images into browser cache
        let loaded = 0;
        await Promise.allSettled(
          photos.map((photo) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                loaded++;
                const pct = 30 + Math.round((loaded / photos.length) * 65);
                setProgress(pct);
                resolve();
              };
              img.onerror = () => {
                loaded++;
                const pct = 30 + Math.round((loaded / photos.length) * 65);
                setProgress(pct);
                resolve();
              };
              img.src = getPhotoUrl(photo);
            })
          )
        );

        // Phase 3: Cache and navigate
        setProgress(95);
        setStatus('准备就绪...');

        try {
          sessionStorage.setItem('preloadedPhotos', JSON.stringify(photos));
          sessionStorage.setItem('preloadedPhotosTs', String(Date.now()));
        } catch (e) { /* quota exceeded */ }

        setProgress(100);

        if (onPhotosLoaded) onPhotosLoaded(photos);

        // Small delay so user sees 100%
        setTimeout(() => {
          navigate('/photography/home', { replace: true });
        }, 200);
      } catch (err) {
        console.error('Loading failed:', err);
        setStatus('加载失败，使用默认图片...');
        setProgress(100);
        if (onPhotosLoaded) onPhotosLoaded(fallbackPhotos);
        navigate('/photography/home', { replace: true });
      }
    };

    loadAndPreload();
  }, [navigate, onPhotosLoaded]);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      background: 'var(--bg-primary)' 
    }}>
      <div style={{ textAlign: 'center', width: 280 }}>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 400, 
          color: 'var(--accent)', 
          letterSpacing: 4, 
          marginBottom: 24 
        }}>
          PHOTO PORTFOLIO
        </div>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
          {status}
        </div>
        <Progress 
          percent={progress} 
          strokeColor="var(--accent)"
          trailColor="var(--border)"
          showInfo={false}
          style={{ marginTop: 12 }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          {progress}%
        </div>
      </div>
    </div>
  );
}
