/** 按原图像素尺寸缩放到视口上限，保证缩略图与原图占位一致 */
export function fitLightboxSize(width, height, maxW, maxH) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0) || !(maxW > 0) || !(maxH > 0)) return null;
  const scale = Math.min(maxW / w, maxH / h, 1);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export function lightboxMaxBox(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
  const mobile = viewportWidth <= 768;
  // 桌面端给右侧作者/时间栏留空，避免卡片顶满把 meta 挤没
  const sideMeta = mobile ? 0 : 140;
  return {
    maxW: Math.max(160, viewportWidth * (mobile ? 0.95 : 0.7) - sideMeta),
    maxH: viewportHeight * (mobile ? 0.5 : 0.7),
  };
}
