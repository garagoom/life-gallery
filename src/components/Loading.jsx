import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Progress } from 'antd';
import { getOrPreloadPhotos } from '../data/preloader';
import { fallbackPhotos } from '../data/photos';

export default function Loading({ onPhotosLoaded }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在获取图片列表...');
  const navigate = useNavigate();
  const loadInitiated = useRef(false);

  useEffect(() => {
    if (loadInitiated.current) return;
    loadInitiated.current = true;

    const loadAndPreload = async () => {
      // getOrPreloadPhotos will use cache if available (from login page preloader)
      setStatus('正在加载图片...');
      const photoData = await getOrPreloadPhotos();
      const finalPhotos = photoData && photoData.length > 0 ? photoData : fallbackPhotos;

      setProgress(100);

      if (onPhotosLoaded) {
        onPhotosLoaded(finalPhotos);
      }

      navigate('/photography/home', { replace: true });
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
