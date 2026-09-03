import { useEffect, useRef } from 'react';
import styles from './CreatorCard.module.css';

export default function CreatorCard({ name, avatar, bio, onClose }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop}>
      <div className={styles.card} ref={cardRef}>
        <div className={styles.tornEdge} />
        <div className={styles.inner}>
          <div className={styles.avatarWrap}>
            {avatar ? (
              <img src={avatar} alt={name} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>
                {(name || '').slice(0, 1) || '?'}
              </div>
            )}
          </div>
          <div className={styles.name}>{name || '未知用户'}</div>
          {bio && <div className={styles.bio}>{bio}</div>}
          {!bio && <div className={styles.bioPlaceholder}>这个人很懒，什么都没写~</div>}
        </div>
        <div className={styles.stain1} />
        <div className={styles.stain2} />
        <div className={styles.coffeeRing} />
      </div>
    </div>
  );
}
