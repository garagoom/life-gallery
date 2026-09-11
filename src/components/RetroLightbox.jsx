import { useEffect, useCallback, useState, useRef } from 'react';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getDisplayUrl, getThumbnailUrl } from '../data/photos';
import { prefetchImage } from '../utils/imageCache';
import { fitLightboxSize, lightboxMaxBox } from '../utils/lightboxSize';
import ExifInfo from './ExifInfo';
import styles from './RetroLightbox.module.css';

const TURN_MS = 520;
const SWIPE_THRESHOLD = 48;
const SWIPE_AXIS_RATIO = 1.15;

function sizeFromPhoto(photo) {
  if (!photo) return null;
  const { maxW, maxH } = lightboxMaxBox();
  return fitLightboxSize(photo.width, photo.height, maxW, maxH);
}

function navDirection(prevPhoto, nextPhoto, list) {
  if (!prevPhoto || !nextPhoto || !list?.length || prevPhoto.id === nextPhoto.id) return 0;
  const prevIdx = list.findIndex((p) => p.id === prevPhoto.id);
  const nextIdx = list.findIndex((p) => p.id === nextPhoto.id);
  if (prevIdx < 0 || nextIdx < 0) return 0;
  const len = list.length;
  if (prevIdx === nextIdx) return 0;
  // 环形：末张→首张算 next，首张→末张算 prev
  if (prevIdx === len - 1 && nextIdx === 0) return 1;
  if (prevIdx === 0 && nextIdx === len - 1) return -1;
  return nextIdx > prevIdx ? 1 : -1;
}

export default function RetroLightbox({ photo, photos, onClose, onNavigate }) {
  const [displayPhoto, setDisplayPhoto] = useState(photo);
  const [thumbSrc, setThumbSrc] = useState(() => (photo ? getThumbnailUrl(photo) : ''));
  const [fullSrc, setFullSrc] = useState('');
  const [fullShown, setFullShown] = useState(false);
  const [slotSize, setSlotSize] = useState(() => sizeFromPhoto(photo));
  // 弹动仅首次进入；翻页只用 turn 动画
  const [motionClass, setMotionClass] = useState(styles.cardOpen);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const photosRef = useRef(photos);
  const photoRef = useRef(photo);
  const openedRef = useRef(false);
  const motionTimerRef = useRef(0);
  const swipeLockRef = useRef(false);
  const suppressClickRef = useRef(false);
  const overlayRef = useRef(null);
  const pointerRef = useRef({
    id: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    axis: null, // 'x' | 'y'
    moved: false,
  });
  photosRef.current = photos;

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onNavigate('prev');
    if (e.key === 'ArrowRight') onNavigate('next');
  }, [onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleKeyDown]);

  // 原生非 passive 监听，保证移动端横滑时可 preventDefault
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return undefined;

    const onMove = (e) => {
      const p = pointerRef.current;
      if (p.id == null || p.axis !== 'x') return;
      if (e.cancelable) e.preventDefault();
    };

    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('pointermove', onMove, { passive: false });
    return () => {
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('pointermove', onMove);
    };
  }, []);

  useEffect(() => {
    if (!photo) return undefined;
    let cancelled = false;
    const full = getDisplayUrl(photo);
    const thumb = getThumbnailUrl(photo);
    const prevPhoto = photoRef.current;
    const dir = navDirection(prevPhoto, photo, photosRef.current);
    photoRef.current = photo;

    if (motionTimerRef.current) {
      window.clearTimeout(motionTimerRef.current);
      motionTimerRef.current = 0;
    }

    if (!openedRef.current) {
      // 第一次点进灯箱：只播弹动
      openedRef.current = true;
      setMotionClass(styles.cardOpen);
      motionTimerRef.current = window.setTimeout(() => {
        if (!cancelled) setMotionClass('');
      }, 500);
    } else if (dir !== 0) {
      // 翻页：只播翻页，绝不套 cardOpen
      swipeLockRef.current = true;
      setDragX(0);
      setDragging(false);
      setMotionClass(dir > 0 ? styles.turnNext : styles.turnPrev);
      motionTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setMotionClass('');
          swipeLockRef.current = false;
        }
      }, TURN_MS);
    } else {
      setMotionClass('');
      swipeLockRef.current = false;
    }

    setDisplayPhoto(photo);
    setThumbSrc(thumb || full);
    setFullSrc('');
    setFullShown(false);
    const initialSize = sizeFromPhoto(photo);
    setSlotSize(initialSize);

    const applyDims = (dims) => {
      if (cancelled || !dims?.width || !dims?.height) return null;
      const { maxW, maxH } = lightboxMaxBox();
      const next = fitLightboxSize(dims.width, dims.height, maxW, maxH);
      if (next) setSlotSize(next);
      return next;
    };

    const reveal = () => {
      if (cancelled) return;
      setFullSrc(full);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setFullShown(true);
        });
      });
    };

    const boot = async () => {
      const dims = await prefetchImage(full);
      if (cancelled) return;
      // 以真实解码尺寸为准，避免库里宽高/方向不一致导致竖图槽位过宽
      if (dims) applyDims(dims);
      else if (!initialSize) applyDims(null);
      reveal();
    };

    boot();

    const list = photosRef.current;
    if (list?.length) {
      const idx = list.findIndex((p) => p.id === photo.id);
      if (idx >= 0) {
        prefetchImage(getDisplayUrl(list[(idx - 1 + list.length) % list.length]));
        prefetchImage(getDisplayUrl(list[(idx + 1) % list.length]));
      }
    }

    const onResize = () => {
      const fromMeta = sizeFromPhoto(photo);
      if (fromMeta) setSlotSize(fromMeta);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      if (motionTimerRef.current) {
        window.clearTimeout(motionTimerRef.current);
        motionTimerRef.current = 0;
      }
    };
  }, [photo]);

  if (!photo) return null;

  const handleBackdropClick = (e) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (e.target === e.currentTarget) onClose();
  };

  const resetPointer = () => {
    pointerRef.current = {
      id: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      axis: null,
      moved: false,
    };
    setDragX(0);
    setDragging(false);
  };

  const onPointerDown = (e) => {
    if (swipeLockRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 点在导航按钮上不抢滑动
    if (e.target.closest?.('button')) return;
    pointerRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      axis: null,
      moved: false,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const p = pointerRef.current;
    if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    p.lastX = e.clientX;

    if (!p.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      p.axis = Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y';
      if (p.axis === 'y') return;
    }
    if (p.axis !== 'x') return;

    p.moved = true;
    // 跟手位移，稍阻尼
    setDragX(dx * 0.72);
    if (e.cancelable) e.preventDefault();
  };

  const finishPointer = (e) => {
    const p = pointerRef.current;
    if (p.id !== e.pointerId) return;
    const dx = (p.lastX || e.clientX) - p.startX;
    const shouldTurn = p.axis === 'x' && p.moved && Math.abs(dx) >= SWIPE_THRESHOLD;
    const direction = dx < 0 ? 'next' : 'prev';
    resetPointer();
    if (shouldTurn && !swipeLockRef.current) {
      suppressClickRef.current = true;
      onNavigate(direction);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  };

  const shown = displayPhoto || photo;
  const slotStyle = slotSize
    ? { width: slotSize.width, height: slotSize.height }
    : undefined;
  const dragStyle = dragging || dragX
    ? {
        transform: `translateX(${dragX}px) rotateY(${dragX * -0.06}deg)`,
        transition: dragging ? 'none' : 'transform 0.2s ease',
      }
    : undefined;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleBackdropClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <div className={styles.container}>
        <button
          className={`${styles.navButton} ${styles.prev}`}
          onClick={() => onNavigate('prev')}
          aria-label="Previous photo"
        >
          ‹
        </button>

        <div className={styles.cardWrapper}>
          <div
            key={shown.id}
            className={`${styles.card} ${motionClass}`.trim()}
            style={dragStyle}
          >
            <div
              className={styles.photoFrame}
              style={{ transform: `rotate(${shown.rotation || 0}deg)` }}
            >
              <div className={styles.imageSlot} style={slotStyle}>
                {slotSize && (
                  <>
                    <img
                      src={thumbSrc}
                      alt=""
                      className={styles.imageLayer}
                      draggable={false}
                      decoding="async"
                    />
                    {fullSrc && (
                      <img
                        src={fullSrc}
                        alt={shown.title}
                        className={`${styles.imageLayer} ${fullShown ? styles.imageReveal : styles.imageHidden}`}
                        draggable={false}
                        decoding="async"
                      />
                    )}
                  </>
                )}
              </div>
              <div className={styles.exifWrap}>
                <ExifInfo photo={shown} />
              </div>
            </div>
          </div>

          {(shown.uploader_display_name || shown.uploaded_by || shown.date) && (
            <div className={styles.meta}>
              {(shown.uploader_display_name || shown.uploaded_by) && (
                <div className={styles.metaLine}>
                  <UserOutlined className={styles.metaIcon} />
                  <span>{shown.uploader_display_name || shown.uploaded_by}</span>
                </div>
              )}
              {shown.date && (
                <div className={styles.metaLine}>
                  <ClockCircleOutlined className={styles.metaIcon} />
                  <span>{formatTime(shown.date)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className={`${styles.navButton} ${styles.next}`}
          onClick={() => onNavigate('next')}
          aria-label="Next photo"
        >
          ›
        </button>
      </div>

      <div className={styles.hint}>
        <span className={styles.hintDesktop}>ESC 关闭 | ← → 切换 | 滑动翻页</span>
        <span className={styles.hintMobile}>左右滑动翻页 · 点空白关闭</span>
      </div>
    </div>
  );
}
