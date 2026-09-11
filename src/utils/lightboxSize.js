/** 上传时旋转大约 ±3°，计算时多留一点余量 */
export const LIGHTBOX_ROTATION_BUDGET_DEG = 4;

/** 旋转后轴对齐包围盒尺寸 */
export function rotatedAabb(width, height, rotationDeg = 0) {
  const w = Number(width);
  const h = Number(height);
  const rad = (Math.abs(Number(rotationDeg) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
}

/**
 * 按原图像素缩放到视口安全盒内，并保证旋转后 AABB 不溢出。
 * maxW/maxH：整张奶油卡（含内边距）旋转后允许占用的最大宽高。
 */
export function fitLightboxSize(width, height, maxW, maxH, rotationDeg = LIGHTBOX_ROTATION_BUDGET_DEG, framePad = {}) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0) || !(maxW > 0) || !(maxH > 0)) return null;

  const padX = Number(framePad.x) >= 0 ? Number(framePad.x) : 30;
  const padY = Number(framePad.y) >= 0 ? Number(framePad.y) : 50;
  const rot = Math.abs(Number(rotationDeg) || 0);

  // 先按未旋转内容区试算，再按旋转 AABB 收敛
  let scale = Math.min((maxW - padX) / w, (maxH - padY) / h, 1);
  if (!(scale > 0)) scale = Math.min(maxW / w, maxH / h, 1);

  const aabb = rotatedAabb(w * scale + padX, h * scale + padY, rot);
  const rotScale = Math.min(maxW / aabb.width, maxH / aabb.height, 1);
  scale *= rotScale;

  let outW = Math.max(1, Math.round(w * scale));
  let outH = Math.max(1, Math.round(h * scale));
  // 四舍五入后可能略超安全盒，再向下收敛 1px
  const rounded = rotatedAabb(outW + padX, outH + padY, rot);
  if (rounded.width > maxW || rounded.height > maxH) {
    const fix = Math.min(maxW / rounded.width, maxH / rounded.height);
    outW = Math.max(1, Math.floor(outW * fix));
    outH = Math.max(1, Math.floor(outH * fix));
  }

  return { width: outW, height: outH };
}

/** 双端安全视口：左右留白 + 导航/信息栏，给旋转溢出预留 */
export function lightboxMaxBox(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
  const mobile = viewportWidth <= 768;
  // 桌面卡片真正居中；右侧 meta 绝对定位，只需对称留白 + 少许右侧溢出余量
  const padX = mobile ? 36 : 100;
  const padY = mobile ? 160 : 120;
  const sideMetaRoom = mobile ? 0 : 48;

  return {
    maxW: Math.max(140, viewportWidth - padX * 2 - sideMetaRoom),
    maxH: Math.max(140, viewportHeight - padY * 2),
    framePad: mobile ? { x: 20, y: 50 } : { x: 30, y: 40 },
  };
}
