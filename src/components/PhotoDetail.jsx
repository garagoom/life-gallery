import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getPhotoById } from '../api/photos';
import { getPhotoUrl } from '../data/photos';
import { getCachedPhoto, cachePhoto } from '../utils/imageCache';
import { extractHistogram } from '../utils/extractHistogram';
import CreatorCard from './CreatorCard';
import styles from './PhotoDetail.module.css';

export default function PhotoDetail({ overlay = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const overlayRef = useRef(null);
  const [photo, setPhoto] = useState(() => getCachedPhoto(id));
  const [loading, setLoading] = useState(!getCachedPhoto(id));
  const [histogramData, setHistogramData] = useState(null);
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
      return;
    }
    setLoading(true);
    getPhotoById(id)
      .then(data => {
        if (!cancelled) {
          cachePhoto(id, data);
          setPhoto(data);
        }
      })
      .catch(() => { if (!cancelled) setPhoto(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    setHistogramData(null);
    overlayRef.current?.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleBack]);

  useEffect(() => {
    if (!photo || histogramData) return;
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return;
    setHistogramData(extractHistogram(img));
  }, [photo, histogramData]);

  const handleImgLoad = useCallback(() => {
    if (histogramData) return;
    const img = imgRef.current;
    if (img) setHistogramData(extractHistogram(img));
  }, [histogramData]);

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
    { label: '焦距', value: photo.focal_length },
    { label: '白平衡', value: photo.white_balance },
    { label: '测光模式', value: photo.metering_mode },
    { label: '闪光灯', value: photo.flash },
    { label: '软件', value: photo.software },
  ].filter(item => item.value);

  const hasGps = photo?.latitude != null && photo?.longitude != null;
  const gpsItems = hasGps ? [
    { label: '纬度', value: photo.latitude?.toFixed(6) },
    { label: '经度', value: photo.longitude?.toFixed(6) },
    photo.altitude != null ? { label: '海拔', value: `${Math.round(photo.altitude)}m` } : null,
  ].filter(Boolean) : [];

  return (
    <div ref={overlayRef} className={overlay ? `${styles.page} ${styles.overlay}` : styles.page}>
      <div className={styles.topNav}>
        <button
          className={styles.navBtn}
          onClick={handleBack}
        >
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
            onLoad={handleImgLoad}
          />
        </div>

        {cameraName && (
          <div className={styles.cameraLine}>{cameraName}{lensName ? `, ${lensName}` : ''}</div>
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
            <span className={styles.creatorName}>{photo.uploader_display_name || photo.uploaded_by}</span>
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
              {exifItems.map(item => (
                <div key={item.label} className={styles.exifItem}>
                  <span className={styles.exifLabel}>{item.label}</span>
                  <span className={styles.exifValue}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gpsItems.length > 0 && (
          <div className={styles.exifCard}>
            <h3 className={styles.exifTitle}>📍 机位信息</h3>
            <div className={styles.exifGrid}>
              {gpsItems.map(item => (
                <div key={item.label} className={styles.exifItem}>
                  <span className={styles.exifLabel}>{item.label}</span>
                  <span className={styles.exifValue}>{item.value}</span>
                </div>
              ))}
            </div>
            <a
              href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: 'var(--accent)' }}
            >
              在地图中查看 →
            </a>
          </div>
        )}

        {histogramData && (
          <div className={styles.exifCard}>
            <h3 className={styles.exifTitle}>色相直方图</h3>
            <Histogram data={histogramData} />
          </div>
        )}
      </div>
    </div>
  );
}

function Histogram({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, displayW, displayH);

    const maxVal = Math.max(...data.r, ...data.g, ...data.b, 1);

    const channels = [
      { arr: data.r, color: 'rgba(255, 0, 0, 0.5)' },
      { arr: data.g, color: 'rgba(0, 180, 0, 0.5)' },
      { arr: data.b, color: 'rgba(0, 80, 255, 0.5)' },
    ];

    for (const ch of channels) {
      ctx.beginPath();
      ctx.moveTo(0, displayH);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * displayW;
        const y = displayH - (ch.arr[i] / maxVal) * displayH * 0.95;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(displayW, displayH);
      ctx.closePath();
      ctx.fillStyle = ch.color;
      ctx.fill();
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 120, borderRadius: 6, background: 'var(--bg-primary)' }}
    />
  );
}
