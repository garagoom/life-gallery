import { describe, it, expect } from 'vitest';
import {
  composeDataPermissions,
  inferAllScopeKeys,
  selectedMenuKeys,
  buildRoleTreeData,
  toDataKey,
  normalizeRoleCheckedKeys,
} from './dataPermissions';

const menus = [
  {
    id: 1,
    key: 'photography',
    has_data_scope: 0,
    label: '摄影',
    type: 'module',
    children: [
      { id: 4, key: 'admin', has_data_scope: 1, label: '照片管理', type: 'button' },
      { id: 9, key: 'review', has_data_scope: 1, label: '审核管理', type: 'button' },
    ],
  },
  {
    id: 5,
    key: 'system',
    has_data_scope: 0,
    label: '系统管理',
    type: 'module',
    children: [
      { id: 6, key: 'users', has_data_scope: 1, label: '用户管理' },
      { id: 7, key: 'roles', has_data_scope: 1, label: '角色管理' },
    ],
  },
];

describe('dataPermissions', () => {
  it('defaults to own when 全站 is not checked', () => {
    const codes = composeDataPermissions({
      menuKeys: selectedMenuKeys([4], menus),
      allScopeKeys: [],
      scopedKeys: ['admin', 'review', 'users', 'roles'],
    });
    expect(codes).toEqual(expect.arrayContaining(['admin.own', 'photos.read.own', 'photos.write.own']));
    expect(codes).not.toContain('photos.write.all');
  });

  it('grants site-wide photo write when 照片管理 全站 is checked', () => {
    const codes = composeDataPermissions({
      menuKeys: ['admin'],
      allScopeKeys: ['admin'],
      scopedKeys: ['admin'],
    });
    expect(codes).toEqual(expect.arrayContaining(['admin.all', 'photos.read.all', 'photos.write.all']));
  });

  it('lets reviewer operate via menu, 全站 only expands data', () => {
    const own = composeDataPermissions({
      menuKeys: ['review'],
      allScopeKeys: [],
      scopedKeys: ['review'],
    });
    expect(own).toEqual(expect.arrayContaining(['review.own', 'photos.review']));
    expect(own).not.toContain('photos.read.all');

    const all = composeDataPermissions({
      menuKeys: ['review'],
      allScopeKeys: ['review'],
      scopedKeys: ['review'],
    });
    expect(all).toEqual(expect.arrayContaining(['review.all', 'photos.review', 'photos.read.all']));
    expect(all).not.toContain('photos.write.all');
  });

  it('maps system 全站 to manage codes', () => {
    expect(composeDataPermissions({
      menuKeys: ['users', 'roles'],
      allScopeKeys: ['users'],
      scopedKeys: ['users', 'roles'],
    })).toEqual(expect.arrayContaining(['users.all', 'users.manage', 'roles.own']));
  });

  it('maps travel menus to trips and budgets own/all codes', () => {
    const own = composeDataPermissions({
      menuKeys: ['travel_trips', 'travel_budget'],
      allScopeKeys: [],
      scopedKeys: ['travel_trips', 'travel_budget'],
    });
    expect(own).toEqual(expect.arrayContaining([
      'travel_trips.own',
      'travel_budget.own',
      'trips.read.own',
      'trips.write.own',
      'budgets.read.own',
      'budgets.write.own',
    ]));
    expect(own).not.toContain('trips.write.all');
    expect(own).not.toContain('budgets.write.all');

    const all = composeDataPermissions({
      menuKeys: ['travel_trips'],
      allScopeKeys: ['travel_trips'],
      scopedKeys: ['travel_trips'],
    });
    expect(all).toEqual(expect.arrayContaining(['travel_trips.all', 'trips.read.all', 'trips.write.all']));
    expect(all).not.toContain('budgets.read.all');

    const shopping = composeDataPermissions({
      menuKeys: ['travel_shopping'],
      allScopeKeys: [],
      scopedKeys: ['travel_shopping'],
    });
    expect(shopping).toEqual(expect.arrayContaining([
      'travel_shopping.own',
      'trips.read.own',
      'budgets.read.own',
      'budgets.write.own',
    ]));
  });

  it('maps calendar menu to photo read own/all', () => {
    const own = composeDataPermissions({
      menuKeys: ['calendar'],
      allScopeKeys: [],
      scopedKeys: ['calendar'],
    });
    expect(own).toEqual(expect.arrayContaining(['calendar.own', 'photos.read.own']));
    expect(own).not.toContain('photos.read.all');

    const all = composeDataPermissions({
      menuKeys: ['calendar'],
      allScopeKeys: ['calendar'],
      scopedKeys: ['calendar'],
    });
    expect(all).toEqual(expect.arrayContaining(['calendar.all', 'photos.read.all']));
  });

  it('infers 全站 keys from stored codes', () => {
    expect(inferAllScopeKeys(['admin.all', 'photos.write.all', 'users.manage'])).toEqual(
      expect.arrayContaining(['admin', 'users'])
    );
    expect(inferAllScopeKeys(['trips.write.all'])).toEqual(
      expect.arrayContaining(['travel_trips'])
    );
    expect(inferAllScopeKeys(['trips.write.all'])).not.toContain('travel_budget');
    expect(inferAllScopeKeys(['budgets.write.all'])).toEqual(
      expect.arrayContaining(['travel_budget'])
    );
    expect(inferAllScopeKeys(['travel_shopping.all'])).toEqual(
      expect.arrayContaining(['travel_shopping'])
    );
  });

  it('inserts a 数据 node under each scoped menu', () => {
    const tree = buildRoleTreeData(menus);
    const photo = tree[0].children.find((item) => item.key === 4);
    expect(photo.title).toBe('照片管理 (按钮)');
    expect(photo.children.some((child) => child.key === toDataKey(4) && child.title === '照片管理 (数据)')).toBe(true);
    expect(tree[0].children.some((child) => child.title === '摄影 (数据)')).toBe(false);
  });

  it('checking 数据 also checks the parent menu', () => {
    expect(normalizeRoleCheckedKeys([toDataKey(4)], [])).toEqual(expect.arrayContaining([4, toDataKey(4)]));
  });

  it('unchecking the menu drops its 数据 node', () => {
    expect(normalizeRoleCheckedKeys([toDataKey(4)], [4, toDataKey(4)])).toEqual([]);
  });
});
