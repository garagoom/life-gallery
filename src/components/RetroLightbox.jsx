import { useEffect, useCallback, useState } from 'react';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getPhotoUrl, getThumbnailUrl } from '../data/photos';
import { prefetchImage, isImageLoaded } from '../utils/imageCache';
import ExifInfo from './ExifInfo';
import styles from './RetroLightbox.module.css';

export default function RetroLightbox({ photo, photos, onClose, onNavigate }) {
  const [displayPhoto, setDisplayPhoto] = useState(photo);
  const [displaySrc, setDisplaySrc] = useState(
    () => (photo && isImageLoaded(getPhotoUrl(photo)) ? getPhotoUrl(photo) : getThumbnailUrl(photo))
  );

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

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    const full = getPhotoUrl(photo);

    const apply = () => {
      if (cancelled) return;
      setDisplayPhoto(photo);
      setDisplaySrc(full);
    };

    if (isImageLoaded(full)) apply();
    else prefetchImage(full).then(apply);

    if (photos?.length) {
      const idx = photos.findIndex((p) => p.id === photo.id);
      if (idx >= 0) {
        const prev = photos[(idx - 1 + photos.length) % photos.length];
        const next = photos[(idx + 1) % photos.length];
        prefetchImage(getPhotoUrl(prev));
        prefetchImage(getPhotoUrl(next));
      }
    }

    return () => { cancelled = true; };
  }, [photo, photos]);

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

  const shown = displayPhoto || photo;

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
              style={{ transform: `rotate(${shown.rotation || 0}deg)` }}
            >
              <img
                src={displaySrc}
                alt={shown.title}
                className={styles.image}
                decoding="async"
              />
              <ExifInfo photo={shown} />
            </div>
          </div>

          {(shown.uploader_display_name || shown.uploaded_by || shown.date) && (
            <div className={styles.meta}>
              {(shown.uploader_display_name || shown.uploaded_by) && (
                <div className={styles.metaLine}>
                  <UserOutlined className={styles.metaIcon} />
                  <span>{shown.uploader_display_name || shown.uploaded_by}</span>
                </div>
              )}
              {shown.date && (
                <div className={styles.metaLine}>
                  <ClockCircleOutlined className={styles.metaIcon} />
                  <span>{formatTime(shown.date)}</span>
                </div>
              )}
            </div>
          )}
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
