import { useEffect, useMemo, useState } from 'react';
import {
  formatTripDayDate,
  pickTodayTripDay,
  shortTripDayDate,
  todayInShanghai,
} from '../../utils/tripToday';
import styles from './travel.module.css';

export default function TripTodayBanner({ days = [], startDate, today = todayInShanghai() }) {
  const todayDay = useMemo(
    () => pickTodayTripDay(days, today, startDate),
    [days, today, startDate],
  );
  const [selectedKey, setSelectedKey] = useState(todayDay?._key || days[0]?._key || '');

  useEffect(() => {
    setSelectedKey((prev) => {
      if (days.some((day) => day._key === prev)) return prev;
      return todayDay?._key || days[0]?._key || '';
    });
  }, [days, todayDay]);

  const selected = days.find((day) => day._key === selectedKey) || todayDay || days[0] || null;
  const selectedIsToday = Boolean(selected && todayDay && selected._key === todayDay._key);

  return (
    <section className={styles.todayPlan} aria-label="今日行程">
      {days.length ? (
        <div className={styles.todayPlanDays}>
          {days.map((day, index) => {
            const n = Number(day.day_index) || index + 1;
            const active = selected?._key === day._key;
            const isTodayChip = todayDay?._key === day._key;
            return (
              <button
                key={day._key}
                type="button"
                className={[
                  styles.todayPlanChip,
                  active ? styles.todayPlanChipActive : '',
                  isTodayChip ? styles.todayPlanChipToday : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedKey(day._key)}
              >
                <strong>DAY {n}</strong>
                <span>{isTodayChip ? '今天' : (shortTripDayDate(day.date) || day.title || '日程')}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {selected ? (
        <div>
          <p className={styles.todayPlanEyebrow}>
            {[
              selectedIsToday ? '今天' : null,
              selected.day_index ? `DAY ${selected.day_index}` : null,
              formatTripDayDate(selected.date),
            ].filter(Boolean).join(' · ')}
          </p>
          <h3 className={styles.todayPlanTitle}>{selected.title || '暂无主题'}</h3>
          {selected.lodging ? <p className={styles.todayPlanMeta}>住宿 {selected.lodging}</p> : null}
          {selected.notes ? <p className={styles.todayPlanNotes}>{selected.notes}</p> : null}
        </div>
      ) : (
        <p className={styles.todayPlanMeta}>行程进行中，今天还没有对应的日程</p>
      )}
    </section>
  );
}
