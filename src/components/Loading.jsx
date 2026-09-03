import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Progress } from 'antd';
import { getRandomPhotos } from '../api/photos';
import { getThumbnailUrl } from '../data/photos';
import { fallbackPhotos } from '../data/photos';
import { getCachedPhotos } from '../data/preloader';
import { prefetchImages, prefetchImage } from '../utils/imageCache';

export default function Loading({ onPhotosLoaded }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在连接服务器...');
  const navigate = useNavigate();
  const loadInitiated = useRef(false);

  useEffect(() => {
    if (loadInitiated.current) return;
    loadInitiated.current = true;

    const goHome = (photos) => {
      if (onPhotosLoaded) onPhotosLoaded(photos);
      setProgress(100);
      setTimeout(() => {
        navigate('/photography/home', { replace: true });
      }, 120);
    };

    const loadAndPreload = async () => {
      try {
        const cached = getCachedPhotos();
        if (cached?.length) {
          setStatus('读取缓存...');
          setProgress(70);
          prefetchImages(cached.map(getThumbnailUrl));
          goHome(cached);
          return;
        }

        setStatus('正在获取图片列表...');
        setProgress(10);

        const result = await getRandomPhotos(20);
        const photos = result.data || [];

        if (photos.length === 0) {
          setStatus('使用默认图片...');
          goHome(fallbackPhotos);
          return;
        }

        try {
          sessionStorage.setItem('preloadedPhotos', JSON.stringify(photos));
          sessionStorage.setItem('preloadedPhotosTs', String(Date.now()));
        } catch { /* quota exceeded */ }

        const thumbs = photos.map(getThumbnailUrl);
        const preloadCount = Math.min(5, thumbs.length);
        setStatus(`正在预加载 ${preloadCount} 张缩略图...`);
        setProgress(30);

        let loaded = 0;
        await Promise.allSettled(
          thumbs.slice(0, preloadCount).map(async (url) => {
            await prefetchImage(url);
            loaded++;
            setProgress(30 + Math.round((loaded / preloadCount) * 60));
          })
        );

        prefetchImages(thumbs.slice(preloadCount));
        setStatus('准备就绪...');
        goHome(photos);
      } catch (err) {
        console.error('Loading failed:', err);
        setStatus('加载失败，使用默认图片...');
        goHome(fallbackPhotos);
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
