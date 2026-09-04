import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getPhotoById } from '../api/photos';
import { getPhotoUrl } from '../data/photos';
import { getCachedPhoto, cachePhoto } from '../utils/imageCache';
import {
  extractImageAnalysis,
  parseStoredHistogram,
  parseStoredPalette,
} from '../utils/extractImageAnalysis';
import { formatMeteringMode, formatWhiteBalance, formatExposureBias } from '../utils/exifFormat';
import CreatorCard from './CreatorCard';
import RgbWaveform from './RgbWaveform';
import styles from './PhotoDetail.module.css';

export default function PhotoDetail({ overlay = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const overlayRef = useRef(null);
  const [photo, setPhoto] = useState(() => getCachedPhoto(id));
  const [loading, setLoading] = useState(!getCachedPhoto(id));
  const [histogramData, setHistogramData] = useState(null);
  const [palette, setPalette] = useState([]);
  const [creatorCardOpen, setCreatorCardOpen] = useState(false);
  const imgRef = useRef(null);

  const handleBack = useCallback(() => {
    if (overlay || location.state?.background) {
      navigate(-1);
      return;
    }
    navigate('/photography/portfolio');
  }, [overlay, location.state, navigate]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedPhoto(id);
    if (cached) {
      setPhoto(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    getPhotoById(id)
      .then((data) => {
        if (!cancelled) {
          cachePhoto(id, data);
          setPhoto(data);
        }
      })
      .catch(() => {
        if (!cancelled && !cached) setPhoto(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setHistogramData(null);
    setPalette([]);
    overlayRef.current?.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleBack]);

  const applyStoredAnalysis = useCallback((nextPhoto) => {
    const storedHistogram = parseStoredHistogram(nextPhoto?.histogram);
    const storedPalette = parseStoredPalette(nextPhoto?.palette);
    if (storedHistogram) {
      setHistogramData(storedHistogram);
      setPalette(storedPalette);
      return true;
    }
    return false;
  }, []);

  const scanFromImage = useCallback((img) => {
    if (!img || !img.naturalWidth) return;
    try {
      const analysis = extractImageAnalysis(img);
      setHistogramData(analysis.histogram);
      setPalette(analysis.palette);
    } catch {
      setHistogramData(null);
    }
  }, []);

  useEffect(() => {
    if (!photo) return;
    if (applyStoredAnalysis(photo)) return;
    if (photo.histogram === undefined && photo.palette === undefined) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) scanFromImage(img);
  }, [photo, applyStoredAnalysis, scanFromImage]);

  const handleImgLoad = useCallback((e) => {
    if (applyStoredAnalysis(photo)) return;
    if (photo?.histogram === undefined && photo?.palette === undefined) return;
    scanFromImage(e.currentTarget);
  }, [photo, applyStoredAnalysis, scanFromImage]);

  if (loading) {
    return (
      <div ref={overlayRef} className={overlay ? `${styles.page} ${styles.overlay}` : styles.page}>
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  if (!photo) {
    return (
      <div ref={overlayRef} className={overlay ? `${styles.page} ${styles.overlay}` : styles.page}>
        <div className={styles.notFound}>照片不存在</div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}:${sec}`;
  };

  const cameraName = photo.camera_model || photo.camera_make || '';
  const lensName = photo.lens_model || '';

  const exifItems = [
    { label: '相机型号', value: cameraName },
    { label: '镜头', value: lensName },
    { label: '光圈', value: photo.f_number },
    { label: '快门速度', value: photo.exposure_time },
    { label: 'ISO', value: photo.iso },
    { label: '曝光补偿', value: formatExposureBias(photo.exposure_bias) },
    { label: '焦距', value: photo.focal_length },
    { label: '白平衡', value: formatWhiteBalance(photo.white_balance) },
    { label: '测光模式', value: formatMeteringMode(photo.metering_mode) },
    { label: '闪光灯', value: photo.flash },
    { label: '软件', value: photo.software },
  ].filter((item) => item.value);

  return (
    <div ref={overlayRef} className={overlay ? `${styles.page} ${styles.overlay}` : styles.page}>
      <div className={styles.topNav}>
        <button className={styles.navBtn} onClick={handleBack}>
          返回
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.photoSection}>
          <img
            ref={imgRef}
            src={getPhotoUrl(photo)}
            alt={photo.title}
            className={styles.photo}
            crossOrigin="anonymous"
            onLoad={handleImgLoad}
          />
        </div>

        {cameraName && (
          <div className={styles.cameraLine}>
            {cameraName}
            {lensName ? `, ${lensName}` : ''}
          </div>
        )}

        <h1 className={styles.title}>{photo.title || 'Untitled'}</h1>

        {(photo.uploader_display_name || photo.uploaded_by) && (
          <div
            className={styles.creatorLine}
            onClick={() => setCreatorCardOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            {photo.uploader_avatar ? (
              <img src={photo.uploader_avatar} alt="" className={styles.creatorAvatar} />
            ) : (
              <div className={styles.creatorAvatarPlaceholder}>
                {(photo.uploader_display_name || photo.uploaded_by || '').slice(0, 1)}
              </div>
            )}
            <span className={styles.creatorName}>
              {photo.uploader_display_name || photo.uploaded_by}
            </span>
          </div>
        )}

        {creatorCardOpen && (
          <CreatorCard
            name={photo.uploader_display_name || photo.uploaded_by}
            avatar={photo.uploader_avatar}
            bio={photo.uploader_bio}
            onClose={() => setCreatorCardOpen(false)}
          />
        )}

        {photo.date && (
          <div className={styles.dateLine}>
            <span className={styles.dateLabel}>发布日期：</span>
            <span className={styles.dateValue}>{formatDate(photo.date)}</span>
          </div>
        )}

        {exifItems.length > 0 && (
          <div className={styles.exifCard}>
            <h3 className={styles.exifTitle}>图像拍摄信息</h3>
            <div className={styles.exifGrid}>
              {exifItems.map((item) => (
                <div key={item.label} className={styles.exifItem}>
                  <span className={styles.exifLabel}>{item.label}</span>
                  <span className={styles.exifValue}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {histogramData && (
          <div className={styles.exifCard}>
            <RgbWaveform data={histogramData} />
          </div>
        )}

        {palette.length > 0 && (
          <div className={styles.exifCard}>
            <h3 className={styles.exifTitle}>主色</h3>
            <div className={styles.paletteRow}>
              {palette.map((c) => (
                <div key={c.hex} className={styles.paletteItem} title={c.hex}>
                  <span className={styles.paletteSwatch} style={{ background: c.hex }} />
                  <span className={styles.paletteHex}>{c.hex}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
