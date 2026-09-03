import { useState, useEffect, useRef } from 'react';
import { getPhotoUrl, getThumbnailUrl } from '../data/photos';
import { prefetchImage, prefetchImages, isImageLoaded } from '../utils/imageCache';
import styles from './HomePage.module.css';

const PREFETCH_AHEAD = 3;

export default function HomePage({ onPhotoClick, isPaused, initialPhotos = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const shuffledRef = useRef([]);
  const photoWidths = useRef({});

  useEffect(() => {
    if (initialPhotos.length > 0) {
      shuffledRef.current = [...initialPhotos].sort(() => Math.random() - 0.5);
      setCurrentIndex(0);
      const thumbs = shuffledRef.current.map(getThumbnailUrl);
      prefetchImages(thumbs.slice(0, 8));
      const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
      const idleId = idle(() => prefetchImages(thumbs.slice(8)));
      return () => {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
        else clearTimeout(idleId);
      };
    }
  }, [initialPhotos]);

  const getPhotoWidth = (id) => {
    if (!photoWidths.current[id]) {
      photoWidths.current[id] = 35 + Math.random() * 35;
    }
    return photoWidths.current[id];
  };

  useEffect(() => {
    const photos = shuffledRef.current;
    if (photos.length <= 1) return;
    const urls = [];
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const photo = photos[(currentIndex + i) % photos.length];
      if (photo) urls.push(getThumbnailUrl(photo));
    }
    prefetchImages(urls);
  }, [currentIndex]);

  useEffect(() => {
    if (isPaused || shuffledRef.current.length <= 1) return;
    const interval = setInterval(() => {
      const photos = shuffledRef.current;
      const nextIdx = (currentIndex + 1) % photos.length;
      const nextUrl = getThumbnailUrl(photos[nextIdx]);
      if (isImageLoaded(nextUrl)) {
        setCurrentIndex(nextIdx);
        return;
      }
      prefetchImage(nextUrl).then(() => {
        setCurrentIndex((prev) => (prev === currentIndex ? nextIdx : prev));
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isPaused, currentIndex]);

  const handleClick = () => {
    const photo = shuffledRef.current[currentIndex];
    if (!photo) return;
    prefetchImage(getPhotoUrl(photo));
    onPhotoClick(photo);
  };

  if (shuffledRef.current.length === 0) return null;

  const currentPhoto = shuffledRef.current[currentIndex];
  const currentWidth = getPhotoWidth(currentPhoto.id);

  return (
    <div className={styles.container} onClick={handleClick}>
      <div className={styles.header}>
        <span className={styles.logo}>PHOTO PORTFOLIO</span>
      </div>

      <div className={styles.photoContainer}>
        <div className={styles.photoWrapper}>
          <img
            src={getThumbnailUrl(currentPhoto)}
            alt={currentPhoto.title}
            className={styles.photo}
            style={{ maxWidth: `${currentWidth}vw` }}
            decoding="async"
          />
        </div>
      </div>

      <div className={styles.hint}>
        点击任意位置查看
      </div>
    </div>
  );
}
