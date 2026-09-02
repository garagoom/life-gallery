import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPhotoById } from '../api/photos';
import { getPhotoUrl } from '../data/photos';
import styles from './PhotoDetail.module.css';

export default function PhotoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPhotoById(id)
      .then(data => { if (!cancelled) setPhoto(data); })
      .catch(() => { if (!cancelled) setPhoto(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') navigate('/photography/portfolio');
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigate]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className={styles.page}>
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

  const histogramData = (() => {
    if (!photo?.histogram) return null;
    try { return JSON.parse(photo.histogram); } catch { return null; }
  })();

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <button
          className={styles.navBtn}
          onClick={() => navigate('/photography/portfolio')}
        >
          返回
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.photoSection}>
          <img
            src={getPhotoUrl(photo)}
            alt={photo.title}
            className={styles.photo}
          />
        </div>

        {cameraName && (
          <div className={styles.cameraLine}>{cameraName}{lensName ? `, ${lensName}` : ''}</div>
        )}

        <h1 className={styles.title}>{photo.title || 'Untitled'}</h1>

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
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const channels = [
      { arr: data.r, color: 'rgba(255, 0, 0, 0.5)' },
      { arr: data.g, color: 'rgba(0, 180, 0, 0.5)' },
      { arr: data.b, color: 'rgba(0, 80, 255, 0.5)' },
    ];

    for (const ch of channels) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const y = h - (ch.arr[i] / 100) * h;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = ch.color;
      ctx.fill();
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={512}
      height={120}
      style={{ width: '100%', height: 120, borderRadius: 6, background: '#1a1a1a' }}
    />
  );
}
