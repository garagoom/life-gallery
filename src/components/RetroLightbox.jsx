import { useEffect, useCallback } from 'react';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getPhotoUrl } from '../data/photos';
import ExifInfo from './ExifInfo';
import styles from './RetroLightbox.module.css';

export default function RetroLightbox({ photo, photos, onClose, onNavigate }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onNavigate('prev');
    if (e.key === 'ArrowRight') onNavigate('next');
  }, [onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleKeyDown]);

  if (!photo) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.container}>
        <button 
          className={`${styles.navButton} ${styles.prev}`}
          onClick={() => onNavigate('prev')}
          aria-label="Previous photo"
        >
          ‹
        </button>
        
        <div className={styles.cardWrapper}>
          <div className={styles.card}>
            <div 
              className={styles.photoFrame}
              style={{ transform: `rotate(${photo.rotation}deg)` }}
            >
              <img 
                src={getPhotoUrl(photo)} 
                alt={photo.title}
                className={styles.image}
              />
              <ExifInfo photo={photo} />
            </div>
            
            {(photo.uploaded_by || photo.created_at) && (
              <div className={styles.meta}>
                {photo.uploaded_by && (
                  <div className={styles.metaLine}>
                    <UserOutlined className={styles.metaIcon} />
                    <span>{photo.uploaded_by}</span>
                  </div>
                )}
                {photo.created_at && (
                  <div className={styles.metaLine}>
                    <ClockCircleOutlined className={styles.metaIcon} />
                    <span>{formatTime(photo.created_at)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <button 
          className={`${styles.navButton} ${styles.next}`}
          onClick={() => onNavigate('next')}
          aria-label="Next photo"
        >
          ›
        </button>
      </div>
      
      <div className={styles.hint}>
        ESC 关闭 | ← → 切换
      </div>
    </div>
  );
}
