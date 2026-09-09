import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { LeftOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow } from 'swiper/modules';
import { getPhotos } from '../api/photos';
import { getDisplayUrl, getMediumUrl, getThumbnailUrl, toAvifUrl } from '../data/photos';
import { cachePhotoList } from '../utils/imageCache';
import { photoDateKey } from '../utils/photoCalendar';
import styles from './PhotoCalendarDay.module.css';

import 'swiper/css';
import 'swiper/css/effect-coverflow';

export default function PhotoCalendarDay() {
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const day = dayjs(dateParam);
  const valid = day.isValid() && /^\d{4}-\d{2}-\d{2}$/.test(dateParam || '');

  const [photos, setPhotos] = useState(() => location.state?.dayPhotos || []);
  const [loading, setLoading] = useState(!location.state?.dayPhotos?.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;

    const cached = location.state?.dayPhotos;
    if (cached?.length) {
      setPhotos(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    getPhotos({
      dateFrom: dateParam,
      dateTo: dateParam,
      page: 1,
      pageSize: 200,
    })
      .then((result) => {
        if (cancelled) return;
        const data = (result.data || []).filter((photo) => photoDateKey(photo) === dateParam);
        cachePhotoList(data);
        setPhotos(data);
        setActiveIndex(0);
      })
      .catch(() => {
        if (!cancelled && !cached?.length) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateParam, valid, location.state]);

  const backToCalendar = () => {
    const from = location.state?.fromCalendar;
    if (typeof from === 'string' && from.startsWith('/photography/calendar')) {
      navigate(from);
      return;
    }
    navigate(`/photography/calendar?month=${day.format('YYYY-MM')}`);
  };

  const openPhoto = (photo) => {
    if (!photo) return;
    navigate(`/photography/photo/${photo.id}`, { state: { background: location } });
  };

  const onCardClick = (index, photo) => {
    if (movedRef.current) return;
    if (index !== activeIndex) {
      swiperRef.current?.slideTo(index);
      return;
    }
    openPhoto(photo);
  };

  if (!valid) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={() => navigate('/photography/calendar')}>
            <LeftOutlined />
          </button>
          <div className={styles.headerText}>
            <h1 className={styles.title}>无效日期</h1>
          </div>
          <span className={styles.headerSpacer} />
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={backToCalendar}
          aria-label="返回日历"
        >
          <LeftOutlined />
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{day.format('M月D日')}</h1>
          <p className={styles.subtitle}>
            {day.format('YYYY年 · dddd')}
            {!loading && ` · ${photos.length} 张`}
          </p>
        </div>
        <span className={styles.headerSpacer} />
      </header>

      <section className={styles.stageWrap}>
        {loading ? (
          <div className={styles.empty}>
            <Spin />
          </div>
        ) : photos.length === 0 ? (
          <div className={styles.empty}>这一天还没有照片</div>
        ) : (
          <>
            <Swiper
              className={styles.swiper}
              modules={[EffectCoverflow]}
              effect="coverflow"
              grabCursor
              centeredSlides
              slidesPerView="auto"
              spaceBetween={18}
              speed={480}
              resistanceRatio={0.7}
              coverflowEffect={{
                rotate: 0,
                stretch: -28,
                depth: 140,
                modifier: 1.15,
                slideShadows: false,
              }}
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
              }}
              onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
              onSliderMove={() => {
                movedRef.current = true;
              }}
              onTouchEnd={() => {
                window.setTimeout(() => {
                  movedRef.current = false;
                }, 40);
              }}
              onTransitionEnd={() => {
                movedRef.current = false;
              }}
            >
              {photos.map((photo, index) => {
                const thumbUrl = getThumbnailUrl(photo);
                const mediumUrl = getMediumUrl(photo);
                const displayUrl = getDisplayUrl(photo);
                const useAvif = Number(photo.has_avif) === 1;
                const avifSrc = useAvif ? toAvifUrl(mediumUrl || thumbUrl) : null;

                return (
                  <SwiperSlide key={photo.id} className={styles.slide}>
                    <button
                      type="button"
                      className={`${styles.switcherCard} ${index === activeIndex ? styles.switcherCardActive : ''}`}
                      onClick={() => onCardClick(index, photo)}
                      aria-label={photo.title || `照片 ${index + 1}`}
                    >
                      <picture>
                        {avifSrc && <source type="image/avif" srcSet={avifSrc} />}
                        <img
                          src={displayUrl}
                          srcSet={mediumUrl ? `${thumbUrl} 300w, ${mediumUrl} 1200w` : undefined}
                          sizes="(max-width: 720px) 78vw, 420px"
                          alt=""
                          draggable={false}
                          decoding="async"
                        />
                      </picture>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardTitle}>{photo.title || '未命名'}</span>
                        {(photo.camera_model || photo.camera_make) && (
                          <span className={styles.cardCamera}>
                            {photo.camera_model || photo.camera_make}
                          </span>
                        )}
                      </div>
                    </button>
                  </SwiperSlide>
                );
              })}
            </Swiper>

            <div className={styles.footer}>
              <div className={styles.dots} role="tablist" aria-label="当天照片">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                    aria-label={`第 ${index + 1} 张`}
                    aria-selected={index === activeIndex}
                    onClick={() => swiperRef.current?.slideTo(index)}
                  />
                ))}
              </div>
              <span className={styles.counter}>
                {activeIndex + 1} / {photos.length}
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
