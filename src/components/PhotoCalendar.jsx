import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { getPhotos } from '../api/photos';
import { getThumbnailUrl } from '../data/photos';
import { cachePhotoList } from '../utils/imageCache';
import { groupPhotosByDate, latestShootMonth } from '../utils/photoCalendar';
import styles from './PhotoCalendar.module.css';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function buildMonthCells(cursor) {
  const start = cursor.startOf('month');
  const offset = start.day();
  const today = dayjs();
  const cells = [];
  const gridStart = start.subtract(offset, 'day');

  for (let i = 0; i < 42; i += 1) {
    const date = gridStart.add(i, 'day');
    const outside = !date.isSame(cursor, 'month');
    cells.push({
      key: date.format('YYYY-MM-DD'),
      day: date.date(),
      row: Math.floor(i / 7),
      col: i % 7,
      outside,
      isToday: date.isSame(today, 'day'),
    });
  }

  // 末周若全是下月，收掉这一行，避免大片空白
  const lastRowOutside = cells.slice(35).every((cell) => cell.outside);
  return lastRowOutside ? cells.slice(0, 35) : cells;
}

function stickerTilt(id) {
  const n = Number(id) || 0;
  return ((n * 17) % 11) - 5;
}

function initialCursor(searchParams) {
  const month = searchParams.get('month');
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const parsed = dayjs(`${month}-01`);
    if (parsed.isValid()) return parsed.startOf('month');
  }
  return dayjs().startOf('month');
}

export default function PhotoCalendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cursor, setCursor] = useState(() => initialCursor(searchParams));
  const [photosByDate, setPhotosByDate] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [jitterKeys, setJitterKeys] = useState(() => new Set());
  const didJumpRef = useRef(Boolean(searchParams.get('month')));
  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const isCurrentMonth = cursor.isSame(dayjs(), 'month');

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoaded(false);
    setPhotosByDate({});
    setJitterKeys(new Set());

    const dateFrom = cells[0].key;
    const dateTo = cells[cells.length - 1].key;
    const monthFrom = cursor.startOf('month').format('YYYY-MM-DD');
    const monthTo = cursor.endOf('month').format('YYYY-MM-DD');

    (async () => {
      try {
        const monthResult = await getPhotos({
          dateFrom,
          dateTo,
          page: 1,
          pageSize: 200,
        });
        if (cancelled) return;

        const data = monthResult.data || [];
        const monthHasPhotos = data.some((photo) => {
          const key = photo?.date?.slice?.(0, 10);
          return key && key >= monthFrom && key <= monthTo;
        });

        if (!monthHasPhotos && !didJumpRef.current) {
          didJumpRef.current = true;
          const recent = await getPhotos({ page: 1, pageSize: 50 });
          if (cancelled) return;
          const jumpTo = latestShootMonth(recent.data || []);
          if (jumpTo && !jumpTo.isSame(cursor, 'month')) {
            setCursor(jumpTo);
            return;
          }
        }

        didJumpRef.current = true;
        cachePhotoList(data);
        const grouped = groupPhotosByDate(data);
        setPhotosByDate(grouped);

        const photoKeys = Object.keys(grouped);
        const pickCount = Math.min(photoKeys.length, 3 + Math.floor(Math.random() * 3));
        const shuffled = [...photoKeys].sort(() => Math.random() - 0.5);
        setJitterKeys(new Set(shuffled.slice(0, pickCount)));
      } catch {
        if (cancelled) return;
        setPhotosByDate({});
        setJitterKeys(new Set());
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cursor, cells]);

  useEffect(() => {
    if (!loaded) return undefined;
    const timer = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [loaded, photosByDate]);

  const openDay = (dateKey, dayPhotos) => {
    if (!dayPhotos?.length) return;
    navigate(`/photography/calendar/${dateKey}`, {
      state: {
        dayPhotos,
        fromCalendar: `/photography/calendar?month=${cursor.format('YYYY-MM')}`,
      },
    });
  };

  return (
    <div className={styles.studio}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setCursor((prev) => prev.subtract(1, 'month'))}
          aria-label="上一月"
        >
          <LeftOutlined />
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{isCurrentMonth ? '今天' : cursor.format('M月')}</h1>
          <p className={styles.subtitle}>
            {isCurrentMonth ? dayjs().format('YYYY年M月D日 ddd') : cursor.format('YYYY年')}
          </p>
        </div>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setCursor((prev) => prev.add(1, 'month'))}
          aria-label="下一月"
        >
          <RightOutlined />
        </button>
      </header>

      <section className={`${styles.card} ${ready ? styles.cardReady : ''}`}>
        <div className={styles.weekdays}>
          {WEEKDAYS.map((label) => (
            <span key={label} className={styles.weekday}>{label}</span>
          ))}
        </div>

        <div className={styles.grid}>
          {cells.map((cell) => {
            const dayPhotos = photosByDate[cell.key] || [];
            const cover = dayPhotos[0];
            const delay = `${cell.row * 70 + cell.col * 28}ms`;
            const jitter = cover && jitterKeys.has(cell.key);

            return (
              <div key={cell.key} className={styles.cell}>
                <div
                  className={[
                    styles.tile,
                    cell.isToday ? styles.tileToday : '',
                    cell.outside ? styles.tileOutside : '',
                  ].join(' ')}
                >
                  <span className={styles.dateNum}>{cell.day}</span>
                  {cover && (
                    <button
                      type="button"
                      className={`${styles.sticker} ${dayPhotos.length > 1 ? styles.stickerStack : ''}`}
                      style={{
                        '--tilt': `${stickerTilt(cover.id)}deg`,
                        '--delay': delay,
                        '--jitter-delay': `${900 + ((Number(cover.id) * 37) % 1600)}ms`,
                        '--jitter-duration': `${2.6 + ((Number(cover.id) * 13) % 18) / 10}s`,
                      }}
                      onClick={() => openDay(cell.key, dayPhotos)}
                      aria-label={`${cell.day}日，${dayPhotos.length} 张照片`}
                    >
                      <span
                        className={`${styles.stickerMotion} ${jitter ? styles.stickerJitter : ''}`}
                      >
                        {dayPhotos.length > 1 && (
                          <span className={`${styles.stackSheet} ${styles.stackSheetBack}`} aria-hidden />
                        )}
                        {dayPhotos.length > 2 && (
                          <span className={`${styles.stackSheet} ${styles.stackSheetMid}`} aria-hidden />
                        )}
                        <span className={styles.stackFace}>
                          <img src={getThumbnailUrl(cover)} alt="" />
                        </span>
                        {dayPhotos.length > 1 && (
                          <span className={styles.badge}>{dayPhotos.length}</span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
