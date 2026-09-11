/** 在菜单子项里找与 path 最匹配的一项（精确或前缀） */
export function matchMenuChild(path, children = []) {
  if (!path || !children.length) return null;
  let best = null;
  for (const child of children) {
    if (!child?.path) continue;
    if (path === child.path || path.startsWith(`${child.path}/`)) {
      if (!best || child.path.length > best.path.length) best = child;
    }
  }
  return best;
}

/**
 * 解析当前应高亮的菜单 key。
 * - 支持 /photography/calendar/:date 这类子路由
 * - 照片详情弹层用 background.pathname 回推来源页
 * - 匹配失败时返回空字符串，绝不误选「首页」
 */
export function resolveMenuPageKey(pathname, children = [], backgroundPathname) {
  const direct = matchMenuChild(pathname, children);
  if (direct) return direct.key;
  const fromBackground = matchMenuChild(backgroundPathname, children);
  if (fromBackground) return fromBackground.key;
  return '';
}
