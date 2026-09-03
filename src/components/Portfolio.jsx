import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { getPhotos } from '../api/photos';
import { fallbackPhotos } from '../data/photos';
import { cachePhotoList } from '../utils/imageCache';
import MasonryGrid from './MasonryGrid';
import styles from './Portfolio.module.css';

export default function Portfolio() {
  const navigate = useNavigate();
  const location = useLocation();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  const pageSize = 20;

  const handlePhotoClick = useCallback((photo) => {
    navigate(`/photography/photo/${photo.id}`, { state: { background: location } });
  }, [navigate, location]);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const result = await getPhotos({ page: 1, pageSize, scope: 'all' });
        const data = result.data || [];
        cachePhotoList(data);
        setPhotos(data);
        setHasMore(data.length >= pageSize);
        setPage(1);
      } catch {
        setPhotos(fallbackPhotos);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitial();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getPhotos({ page: nextPage, pageSize, scope: 'all' });
      const newPhotos = result.data || [];
      
      if (newPhotos.length > 0) {
        cachePhotoList(newPhotos);
        setPhotos(prev => [...prev, ...newPhotos]);
        setPage(nextPage);
        setHasMore(newPhotos.length >= pageSize);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  useEffect(() => {
    if (loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    observerRef.current = observer;
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadingMore, loadMore]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <h2 className={styles.title}>Portfolio</h2>
        </div>
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={styles.skeletonItem}>
              <div 
                className={styles.skeletonImage}
                style={{ height: i % 3 === 0 ? 280 : i % 2 === 0 ? 200 : 240 }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>Portfolio</h2>
      </div>
      
      <MasonryGrid 
        photos={photos} 
        onPhotoClick={handlePhotoClick} 
      />
      
      <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
        {loadingMore && (
          <div className={styles.loadingMore}>
            <Spin size="small" />
            <span>加载更多...</span>
          </div>
        )}
        {!hasMore && photos.length > 0 && (
          <div className={styles.noMore}>— 没有更多了 —</div>
        )}
      </div>
    </div>
  );
}
