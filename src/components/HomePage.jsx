import { useState, useEffect, useRef } from 'react';
import { getPhotoUrl } from '../data/photos';
import styles from './HomePage.module.css';

export default function HomePage({ onPhotoClick, isPaused, initialPhotos = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const shuffledRef = useRef([]);
  const preloadImgRef = useRef(null);

  useEffect(() => {
    if (initialPhotos.length > 0) {
      shuffledRef.current = [...initialPhotos].sort(() => Math.random() - 0.5);
      setCurrentIndex(0);
    }
  }, [initialPhotos]);

  const photoWidths = useRef({});
  const getPhotoWidth = (id) => {
    if (!photoWidths.current[id]) {
      photoWidths.current[id] = 35 + Math.random() * 35;
    }
    return photoWidths.current[id];
  };

  // Preload next thumbnail
  useEffect(() => {
    const photos = shuffledRef.current;
    if (photos.length <= 1) return;
    const nextIdx = (currentIndex + 1) % photos.length;
    const img = new Image();
    img.src = getPhotoUrl(photos[nextIdx]);
    preloadImgRef.current = img;
  }, [currentIndex]);

  useEffect(() => {
    if (isPaused || shuffledRef.current.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % shuffledRef.current.length);
    }, 500);
    return () => clearInterval(interval);
  }, [isPaused, shuffledRef.current.length]);

  const handleClick = () => {
    const photo = shuffledRef.current[currentIndex];
    if (photo) onPhotoClick(photo);
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
            src={getPhotoUrl(currentPhoto)}
            alt={currentPhoto.title}
            className={styles.photo}
            style={{ maxWidth: `${currentWidth}vw` }}
          />
        </div>
      </div>

      <div className={styles.hint}>
        点击任意位置查看
      </div>
    </div>
  );
}
