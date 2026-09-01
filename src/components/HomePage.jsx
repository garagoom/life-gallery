import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPhotoUrl } from '../data/photos';
import styles from './HomePage.module.css';

export default function HomePage({ onPhotoClick, isPaused, initialPhotos = [] }) {
  const [shuffledPhotos, setShuffledPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Shuffle photos when initialPhotos changes
  useEffect(() => {
    if (initialPhotos.length > 0) {
      const shuffled = [...initialPhotos].sort(() => Math.random() - 0.5);
      setShuffledPhotos(shuffled);
    }
  }, [initialPhotos]);

  const photoWidths = useMemo(() => {
    return shuffledPhotos.map(() => 35 + Math.random() * 35);
  }, [shuffledPhotos]);

  const goToNext = useCallback(() => {
    if (shuffledPhotos.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % shuffledPhotos.length);
  }, [shuffledPhotos.length]);

  useEffect(() => {
    if (isPaused || shuffledPhotos.length === 0) return;
    const interval = setInterval(goToNext, 500);
    return () => clearInterval(interval);
  }, [isPaused, goToNext, shuffledPhotos.length]);

  const handleClick = () => {
    if (shuffledPhotos[currentIndex]) {
      onPhotoClick(shuffledPhotos[currentIndex]);
    }
  };

  if (shuffledPhotos.length === 0) return null;

  const currentPhoto = shuffledPhotos[currentIndex];
  const currentWidth = photoWidths[currentIndex] || 50;

  return (
    <div className={styles.container} onClick={handleClick}>
      <div className={styles.header}>
        <span className={styles.logo}>PHOTO PORTFOLIO</span>
      </div>

      <div className={styles.photoContainer}>
        <div className={styles.photoWrapper}>
          <img
            key={currentPhoto.id}
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
