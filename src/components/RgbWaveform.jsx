import { useCallback, useEffect, useRef, useState } from 'react';
import { toggleChannel } from '../utils/extractRgbParade';
import styles from './RgbWaveform.module.css';

const STORAGE_KEY = 'life-gallery:waveform-channels';
const DEFAULT_VISIBLE = { r: true, g: true, b: true, l: true };

const CHANNELS = [
  ['l', { light: 'rgba(90, 90, 90, 0.45)', dark: 'rgba(220, 220, 220, 0.5)' }],
  ['r', { light: 'rgba(255, 0, 0, 0.5)', dark: 'rgba(255, 70, 70, 0.5)' }],
  ['g', { light: 'rgba(0, 180, 0, 0.5)', dark: 'rgba(60, 200, 80, 0.5)' }],
  ['b', { light: 'rgba(0, 80, 255, 0.5)', dark: 'rgba(80, 140, 255, 0.5)' }],
];

function readVisible() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    const next = {
      r: !!parsed.r,
      g: !!parsed.g,
      b: !!parsed.b,
      l: !!parsed.l,
    };
    if (next.r || next.g || next.b || next.l) return next;
  } catch {}
  return { ...DEFAULT_VISIBLE };
}

function drawHistogram(canvas, data, visible) {
  const dpr = window.devicePixelRatio || 1;
  const displayW = Math.max(1, Math.round(canvas.clientWidth || canvas.parentElement?.clientWidth || 1));
  const displayH = 120;
  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);
  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, displayW, displayH);

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const active = CHANNELS.filter(([key]) => visible[key] && data?.[key]);
  if (!active.length) return;

  const maxVal = Math.max(1, ...active.flatMap(([key]) => data[key]));

  for (const [key, colors] of active) {
    const arr = data[key];
    ctx.beginPath();
    ctx.moveTo(0, displayH);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * displayW;
      const y = displayH - (arr[i] / maxVal) * displayH * 0.95;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(displayW, displayH);
    ctx.closePath();
    ctx.fillStyle = dark ? colors.dark : colors.light;
    ctx.fill();
  }
}

export default function RgbWaveform({ data }) {
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(readVisible);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    drawHistogram(canvas, data, visible);
  }, [data, visible]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas.parentElement || canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const onToggle = (key) => {
    setVisible((prev) => {
      const next = toggleChannel(prev, key);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div>
      <div className={styles.header}>
        <h3 className={styles.title}>直方图</h3>
        <div className={styles.toggles}>
          <button type="button" className={styles.toggle} data-ch="r" data-on={visible.r} onClick={() => onToggle('r')}>R</button>
          <button type="button" className={styles.toggle} data-ch="g" data-on={visible.g} onClick={() => onToggle('g')}>G</button>
          <button type="button" className={styles.toggle} data-ch="b" data-on={visible.b} onClick={() => onToggle('b')}>B</button>
          <button type="button" className={styles.toggle} data-ch="l" data-on={visible.l} onClick={() => onToggle('l')}>L</button>
        </div>
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
