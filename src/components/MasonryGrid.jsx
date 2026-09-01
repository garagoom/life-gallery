import Masonry from 'react-masonry-css';
import { getPhotoUrl } from '../data/photos';
import styles from './MasonryGrid.module.css';

const breakpointColumnsObj = {
  default: 3,
  1024: 2,
  640: 1
};

export default function MasonryGrid({ photos, onPhotoClick }) {
  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className={styles.masonryGrid}
      columnClassName={styles.masonryColumn}
    >
      {photos.map((photo) => (
        <div 
          key={photo.id} 
          className={styles.photoItem}
          onClick={() => onPhotoClick(photo)}
        >
          <img 
            src={getPhotoUrl(photo)} 
            alt={photo.title}
            className={styles.photo}
            loading="lazy"
          />
        </div>
      ))}
    </Masonry>
  );
}
