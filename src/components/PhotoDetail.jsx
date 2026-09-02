import { useEffect, useCallback, useState } from 'react';
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

  const goPrev = useCallback(() => {
    if (photo?.prev_id != null) navigate(`/photography/photo/${photo.prev_id}`);
  }, [photo, navigate]);

  const goNext = useCallback(() => {
    if (photo?.next_id != null) navigate(`/photography/photo/${photo.next_id}`);
  }, [photo, navigate]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') navigate('/photography/portfolio');
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, navigate]);

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

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <button
          className={styles.navBtn}
          onClick={goPrev}
          disabled={!photo.prev_id}
        >
          上一页
        </button>
        <button
          className={styles.navBtn}
          onClick={() => navigate('/photography/portfolio')}
        >
          返回
        </button>
        <button
          className={styles.navBtn}
          onClick={goNext}
          disabled={!photo.next_id}
        >
          下一页
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
      </div>
    </div>
  );
}
