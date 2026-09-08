const { describe, it, expect } = require('vitest');
const { assertAssignableRoles, isDefaultAdminUsername } = require('./userRoles.cjs');

function caught(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

describe('assertAssignableRoles', () => {
  it('rejects assigning admin to a normal user', () => {
    const error = caught(() => assertAssignableRoles(['admin', 'viewer'], { username: 'niko' }));
    expect(error?.statusCode).toBe(403);
    expect(error?.message).toBe('超级管理员角色不可分配');
  });

  it('rejects creating a user with admin', () => {
    const error = caught(() => assertAssignableRoles(['admin']));
    expect(error?.statusCode).toBe(403);
  });

  it('allows normal roles', () => {
    expect(() => assertAssignableRoles(['photography_admin', 'reviewer'])).not.toThrow();
    expect(() => assertAssignableRoles(['travel_admin', 'creator'])).not.toThrow();
  });

  it('keeps admin on the default super admin', () => {
    expect(() => assertAssignableRoles(['admin'], { username: 'admin' })).not.toThrow();
  });

  it('rejects removing admin from the default super admin', () => {
    const error = caught(() => assertAssignableRoles(['viewer'], { username: 'admin' }));
    expect(error?.statusCode).toBe(400);
    expect(isDefaultAdminUsername('admin')).toBe(true);
  });
});
