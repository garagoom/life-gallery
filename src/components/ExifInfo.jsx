import { CameraOutlined } from '@ant-design/icons';
import { getBrandLogo } from '../data/brandLogos';
import styles from './ExifInfo.module.css';

export default function ExifInfo({ photo }) {
  if (!photo) return null;

  const hasCameraInfo = photo.camera_make || photo.camera_model;
  const hasLensInfo = photo.lens_model;
  const hasExposureInfo = photo.exposure_time || photo.f_number || photo.iso || photo.focal_length;

  if (!hasCameraInfo && !hasLensInfo && !hasExposureInfo) return null;

  const formatExposure = (val) => {
    if (!val) return null;
    if (val.includes('/') || val.includes('1/')) {
      const parts = val.replace('1/', '').split('/');
      if (parts.length === 2 && parts[1] === '1') return `1/${parts[0]}s`;
      return val.includes('s') ? val : `${val}s`;
    }
    return val.includes('s') ? val : `${val}s`;
  };

  const formatFNumber = (val) => {
    if (!val) return null;
    return val.startsWith('f/') ? val : `f/${val}`;
  };

  const formatFocalLength = (val) => {
    if (!val) return null;
    return val.includes('mm') ? val : `${val}mm`;
  };

  const cameraName = [photo.camera_make, photo.camera_model].filter(Boolean).join(' ');
  const exposure = formatExposure(photo.exposure_time);
  const fNumber = formatFNumber(photo.f_number);
  const iso = photo.iso ? `ISO ${photo.iso}` : null;
  const focal = formatFocalLength(photo.focal_length);
  const brandLogo = getBrandLogo(photo.camera_make);

  return (
    <div className={styles.container}>
      {cameraName && (
        <div className={styles.line}>
          <span className={styles.brand}>
            {brandLogo || <CameraOutlined className={styles.defaultIcon} />}
          </span>
          <span className={styles.model}>{cameraName}</span>
        </div>
      )}
      <div className={styles.line}>
        <span className={styles.model}>
          {[exposure, fNumber, iso, focal].filter(Boolean).join('  ')}
        </span>
      </div>
    </div>
  );
}