const { describe, it, expect } = require('vitest');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

const {
  requireAdmin,
  hasDataPerm,
  isAdminUser,
  canWritePhoto,
  buildPhotoListFilter,
} = require('./permission.cjs');

describe('Permission helpers', () => {
  const mockRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  describe('requireAdmin', () => {
    it('allows admin role', () => {
      const req = { user: { role: 'admin', roles: ['admin'] } };
      const res = mockRes();
      let nextCalled = false;
      requireAdmin(req, res, () => { nextCalled = true; });
      expect(res.statusCode).toBeNull();
      expect(nextCalled).toBe(true);
    });

    it('rejects photography admin', () => {
      const req = { user: { role: 'photography_admin', roles: ['photography_admin'] } };
      const res = mockRes();
      requireAdmin(req, res, () => {});
      expect(res.statusCode).toBe(403);
    });

    it('rejects when no user', () => {
      const req = {};
      const res = mockRes();
      requireAdmin(req, res, () => {});
      expect(res.statusCode).toBe(401);
    });
  });

  describe('data permissions', () => {
    const photoAdmin = {
      username: 'shenshuai',
      role: 'photography_admin',
      roles: ['photography_admin'],
      permissions: ['photos.read.all', 'photos.write.all', 'photos.review'],
    };
    const reviewer = {
      username: 'auditor',
      role: 'reviewer',
      roles: ['reviewer'],
      permissions: ['photos.read.all', 'photos.review'],
    };
    const combined = {
      username: 'mix',
      role: 'photography_admin',
      roles: ['photography_admin', 'system_admin'],
      permissions: ['photos.read.all', 'photos.write.all', 'photos.review', 'users.manage', 'roles.manage'],
    };
    const otherPhoto = { uploaded_by: 'niko' };
    const ownPhoto = { uploaded_by: 'auditor' };

    it('lets photography admin read the whole catalog', () => {
      expect(buildPhotoListFilter(photoAdmin).sql).toBe('1=1');
      expect(hasDataPerm(photoAdmin, 'photos.read.all')).toBe(true);
    });

    it('lets photography admin edit others photos', () => {
      expect(canWritePhoto(photoAdmin, otherPhoto)).toBe(true);
    });

    it('does not let reviewer delete others photos', () => {
      expect(hasDataPerm(reviewer, 'photos.review')).toBe(true);
      expect(hasDataPerm(reviewer, 'photos.write.all')).toBe(false);
      expect(canWritePhoto(reviewer, otherPhoto)).toBe(false);
      expect(canWritePhoto(reviewer, ownPhoto)).toBe(false);
    });

    it('unions data permissions across multiple roles', () => {
      expect(hasDataPerm(combined, 'photos.write.all')).toBe(true);
      expect(hasDataPerm(combined, 'users.manage')).toBe(true);
      expect(isAdminUser(combined)).toBe(false);
    });

    it('keeps public portfolio on approved photos only', () => {
      expect(buildPhotoListFilter(photoAdmin, { scope: 'all' })).toEqual({
        sql: 'p.review_status = 1',
        params: [],
      });
    });
  });
});
