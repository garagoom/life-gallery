import Masonry from 'react-masonry-css';
import { getThumbnailUrl, getMediumUrl, toAvifUrl } from '../data/photos';
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
        const thumbUrl = getThumbnailUrl(photo);
        const mediumUrl = getMediumUrl(photo);
        const useAvif = Number(photo.has_avif) === 1;
        const avifThumb = useAvif ? toAvifUrl(thumbUrl) : null;
        const avifMedium = useAvif ? toAvifUrl(mediumUrl) : null;
        const ratio = photo.width && photo.height
          ? { aspectRatio: `${photo.width} / ${photo.height}` }
          : undefined;
        const sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
        const webpSrcSet = mediumUrl ? `${thumbUrl} 300w, ${mediumUrl} 1200w` : undefined;
        const avifSrcSet = avifThumb
          ? (avifMedium ? `${avifThumb} 300w, ${avifMedium} 1200w` : `${avifThumb} 300w`)
          : undefined;

        return (
          <div
            key={photo.id}
            className={styles.photoItem}
            onClick={() => handleClick(photo)}
          >
            <picture>
              {avifSrcSet && (
                <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
              )}
              <img
                src={thumbUrl}
                srcSet={webpSrcSet}
                sizes={sizes}
                alt={photo.title}
                className={styles.photo}
                style={ratio}
                loading="lazy"
              />
            </picture>
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
