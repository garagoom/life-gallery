import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Progress } from 'antd';
import { getRandomPhotos } from '../api/photos';
import { fallbackPhotos, getPhotoUrl } from '../data/photos';

export default function Loading({ onPhotosLoaded }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在获取图片列表...');
  const navigate = useNavigate();
  const loadInitiated = useRef(false);

  useEffect(() => {
    if (loadInitiated.current) return;
    loadInitiated.current = true;

    const loadAndPreload = async () => {
      let photoData = fallbackPhotos;
      
      try {
        const result = await getRandomPhotos(20);
        if (result.data && result.data.length > 0) {
          photoData = result.data;
        }
      } catch (err) {
        console.error('Failed to load photos:', err);
      }

      // 预加载所有图片
      setStatus('正在加载图片...');
      await preloadImages(photoData);
      
      // 通知父组件图片已加载
      if (onPhotosLoaded) {
        onPhotosLoaded(photoData);
      }
      
      // 跳转到首页
      navigate('/photography/home', { replace: true });
    };

    loadAndPreload();
  }, [navigate, onPhotosLoaded]);

  const preloadImages = (photoList) => {
    return new Promise((resolve) => {
      if (photoList.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const total = photoList.length;

      const onLoad = () => {
        loadedCount++;
        setProgress(Math.round((loadedCount / total) * 100));
        if (loadedCount >= total) {
          resolve();
        }
      };

      const onError = () => {
        loadedCount++;
        setProgress(Math.round((loadedCount / total) * 100));
        if (loadedCount >= total) {
          resolve();
        }
      };

      photoList.forEach((photo) => {
        const img = new Image();
        img.onload = onLoad;
        img.onerror = onError;
        img.src = getPhotoUrl(photo);
      });
    });
  };

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
