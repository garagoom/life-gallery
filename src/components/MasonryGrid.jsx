import Masonry from 'react-masonry-css';
import { getPhotoUrl } from '../data/photos';
import { getBrandLogo } from '../data/brandLogos';
import { cachePhoto } from '../utils/imageCache';
import { useCallback } from 'react';
import styles from './MasonryGrid.module.css';

const breakpointColumnsObj = {
  default: 3,
  1024: 2,
  640: 1
};

export default function MasonryGrid({ photos, onPhotoClick }) {
  const handleClick = useCallback((photo) => {
    cachePhoto(photo.id, photo);
    onPhotoClick(photo);
  }, [onPhotoClick]);

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className={styles.masonryGrid}
      columnClassName={styles.masonryColumn}
    >
      {photos.map((photo) => {
        const cameraName = photo.camera_model || photo.camera_make || '';
        const brandLogo = getBrandLogo(photo.camera_make);
        const author = photo.uploader_display_name || photo.uploaded_by || '';

        return (
          <div
            key={photo.id}
            className={styles.photoItem}
            onClick={() => handleClick(photo)}
          >
            <img
              src={getPhotoUrl(photo)}
              alt={photo.title}
              className={styles.photo}
              loading="lazy"
            />
            <div className={styles.overlay}>
              <div className={styles.overlayInfo}>
                {cameraName && (
                  <div className={styles.cameraLine}>
                    <span className={styles.cameraModel}>{cameraName}</span>
                    {brandLogo && <span className={styles.brandLogo}>{brandLogo}</span>}
                    {author && <span className={styles.author}>{author}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Masonry>
  );
}
