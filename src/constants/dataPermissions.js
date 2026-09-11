const PHOTO_ADMIN_KEY = 'admin';
const REVIEW_KEY = 'review';
export const DATA_KEY_PREFIX = 'data:';

export function flattenMenus(nodes, acc = []) {
  for (const node of nodes || []) {
    acc.push(node);
    if (node.children?.length) flattenMenus(node.children, acc);
  }
  return acc;
}

export function selectedMenuKeys(checkedKeys, menuTree) {
  const ids = new Set(splitRoleCheckedKeys(checkedKeys).menuIds);
  return flattenMenus(menuTree)
    .filter((item) => ids.has(Number(item.id)))
    .map((item) => item.key);
}

export function scopedMenuKeys(menuTree) {
  return flattenMenus(menuTree)
    .filter((item) => menuHasDataNode(item))
    .map((item) => item.key);
}

export function menuHasDataNode(item) {
  if (!item || item.type === 'module') return false;
  if (item.has_data_scope === 0 || item.has_data_scope === '0') return false;
  return true;
}

export function toDataKey(menuId) {
  return `${DATA_KEY_PREFIX}${menuId}`;
}

export function fromDataKey(key) {
  const value = String(key);
  if (!value.startsWith(DATA_KEY_PREFIX)) return null;
  const id = Number(value.slice(DATA_KEY_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

export function splitRoleCheckedKeys(checkedKeys) {
  const menuIds = [];
  const dataMenuIds = [];
  for (const key of checkedKeys || []) {
    const dataId = fromDataKey(key);
    if (dataId != null) dataMenuIds.push(dataId);
    else {
      const id = Number(key);
      if (Number.isFinite(id)) menuIds.push(id);
    }
  }
  return { menuIds, dataMenuIds };
}

export function normalizeRoleCheckedKeys(nextKeys, prevKeys = []) {
  const prev = splitRoleCheckedKeys(prevKeys);
  const next = splitRoleCheckedKeys(nextKeys);
  const menuSet = new Set(next.menuIds);
  const dataSet = new Set(next.dataMenuIds);

  for (const id of prev.menuIds) {
    if (!menuSet.has(id)) dataSet.delete(id);
  }
  for (const id of dataSet) menuSet.add(id);

  return [...menuSet, ...[...dataSet].map(toDataKey)];
}

export function buildRoleTreeData(items) {
  return (items || []).map((item) => {
    const children = buildRoleTreeData(item.children || []);
    if (menuHasDataNode(item)) {
      children.push({
        key: toDataKey(item.id),
        title: `${item.label} (数据)`,
      });
    }
    const typeLabel = item.type === 'module' ? '模块' : item.type === 'button' ? '按钮' : '菜单';
    return {
      key: item.id,
      title: `${item.label} (${typeLabel})`,
      children,
    };
  });
}

export function allScopeKeysFromChecked(checkedKeys, menuTree) {
  const { dataMenuIds } = splitRoleCheckedKeys(checkedKeys);
  const idSet = new Set(dataMenuIds);
  return flattenMenus(menuTree)
    .filter((item) => idSet.has(Number(item.id)))
    .map((item) => item.key);
}

export function checkedKeysFromPermissions({ permissionIds = [], dataPermissions = [], menuTree = [] } = {}) {
  const allKeys = new Set(inferAllScopeKeys(dataPermissions));
  const dataIds = flattenMenus(menuTree)
    .filter((item) => allKeys.has(item.key))
    .map((item) => toDataKey(item.id));
  return [...permissionIds, ...dataIds];
}

export function inferAllScopeKeys(codes = []) {
  const all = new Set();
  for (const code of codes) {
    const match = String(code).match(/^([a-z0-9_]+)\.all$/i);
    if (match) all.add(match[1]);
  }
  if (codes.includes('photos.write.all')) all.add(PHOTO_ADMIN_KEY);
  if (codes.includes('photos.read.all') && codes.includes('photos.review')) all.add(REVIEW_KEY);
  if (codes.includes('users.manage')) all.add('users');
  if (codes.includes('roles.manage')) all.add('roles');
  if (codes.includes('menus.manage')) all.add('menus');
  if (codes.includes('trips.write.all') || codes.includes('trips.read.all')) {
    all.add('travel_trips');
  }
  if (codes.includes('budgets.write.all') || codes.includes('budgets.read.all')) {
    all.add('travel_budget');
  }
  if (codes.includes('travel_shopping.all')) all.add('travel_shopping');
  return [...all];
}

export function composeDataPermissions({
  menuKeys = [],
  allScopeKeys = [],
  scopedKeys = null,
} = {}) {
  const keys = new Set(menuKeys);
  const all = new Set(allScopeKeys);
  const scoped = scopedKeys ? new Set(scopedKeys) : null;
  const codes = new Set();

  const withScope = (key) => !scoped || scoped.has(key);

  for (const key of keys) {
    if (!withScope(key)) continue;
    codes.add(all.has(key) ? `${key}.all` : `${key}.own`);
  }

  if (keys.has(PHOTO_ADMIN_KEY)) {
    if (all.has(PHOTO_ADMIN_KEY)) {
      codes.add('photos.read.all');
      codes.add('photos.write.all');
    } else {
      codes.add('photos.read.own');
      codes.add('photos.write.own');
    }
  }

  if (keys.has(REVIEW_KEY)) {
    codes.add('photos.review');
    if (all.has(REVIEW_KEY)) codes.add('photos.read.all');
  }

  if (keys.has('calendar') && withScope('calendar')) {
    if (all.has('calendar')) codes.add('photos.read.all');
    else codes.add('photos.read.own');
  }

  if (keys.has('users') && all.has('users')) codes.add('users.manage');
  if (keys.has('roles') && all.has('roles')) codes.add('roles.manage');
  if (keys.has('menus') && all.has('menus')) codes.add('menus.manage');

  if (keys.has('travel_trips') && withScope('travel_trips')) {
    if (all.has('travel_trips')) {
      codes.add('trips.read.all');
      codes.add('trips.write.all');
    } else {
      codes.add('trips.read.own');
      codes.add('trips.write.own');
    }
  }

  if (keys.has('travel_budget') && withScope('travel_budget')) {
    if (all.has('travel_budget')) {
      codes.add('budgets.read.all');
      codes.add('budgets.write.all');
    } else {
      codes.add('budgets.read.own');
      codes.add('budgets.write.own');
    }
  }

  if (keys.has('travel_shopping') && withScope('travel_shopping')) {
    if (all.has('travel_shopping')) {
      codes.add('trips.read.all');
      codes.add('budgets.read.all');
      codes.add('budgets.write.all');
    } else {
      codes.add('trips.read.own');
      codes.add('budgets.read.own');
      codes.add('budgets.write.own');
    }
  }

  return [...codes];
}

export function describeDataAccess({ menuKeys = [], allScopeKeys = [], menuTree = [] } = {}) {
  const keys = new Set(menuKeys);
  const all = new Set(allScopeKeys);
  const lines = [];
  for (const item of flattenMenus(menuTree)) {
    if (!keys.has(item.key) || Number(item.has_data_scope) !== 1) continue;
    lines.push(all.has(item.key)
      ? `${item.label}：可操作全站数据`
      : `${item.label}：只能操作自己的数据`);
  }
  return lines;
}

export { PHOTO_ADMIN_KEY, REVIEW_KEY };
