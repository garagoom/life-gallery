const { describe, it, expect } = require('vitest');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

const {
  requireAdmin,
  hasDataPerm,
  isAdminUser,
  canWritePhoto,
  buildPhotoListFilter,
  visibilitySql,
  buildTripListFilter,
  canWriteTrip,
  buildBudgetListFilter,
  canWriteBudget,
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

    it('keeps public portfolio on approved public photos only', () => {
      expect(buildPhotoListFilter(photoAdmin, { scope: 'all' })).toEqual({
        sql: 'p.review_status = 1 AND IFNULL(p.is_public, 1) = 1',
        params: [],
      });
    });

    it('builds adjacent-photo visibility sql', () => {
      expect(visibilitySql(photoAdmin)).toEqual({ sql: '1=1', params: [] });
      expect(visibilitySql(null)).toEqual({
        sql: 'review_status = 1 AND IFNULL(is_public, 1) = 1',
        params: [],
      });
      expect(visibilitySql({ username: 'niko', permissions: [] })).toEqual({
        sql: '((review_status = 1 AND IFNULL(is_public, 1) = 1) OR uploaded_by = ?)',
        params: ['niko'],
      });
    });

    it('scopes trips to owner unless travel all is granted', () => {
      const owner = {
        username: 'niko',
        permissions: ['trips.read.own', 'trips.write.own'],
      };
      const admin = {
        username: 'travel',
        permissions: ['trips.read.all', 'trips.write.all'],
      };
      expect(buildTripListFilter(owner)).toEqual({ sql: 'created_by = ?', params: ['niko'] });
      expect(buildTripListFilter(admin).sql).toBe('1=1');
      expect(canWriteTrip(owner, { created_by: 'niko' })).toBe(true);
      expect(canWriteTrip(owner, { created_by: 'other' })).toBe(false);
      expect(canWriteTrip(admin, { created_by: 'other' })).toBe(true);
    });

    it('scopes budgets independently from trips', () => {
      const owner = {
        username: 'niko',
        permissions: ['budgets.read.own', 'budgets.write.own'],
      };
      const admin = {
        username: 'travel',
        permissions: ['budgets.read.all', 'budgets.write.all'],
      };
      expect(buildBudgetListFilter(owner)).toEqual({ sql: 'created_by = ?', params: ['niko'] });
      expect(buildBudgetListFilter(admin).sql).toBe('1=1');
      expect(canWriteBudget(owner, { created_by: 'niko' })).toBe(true);
      expect(canWriteBudget(owner, { created_by: 'other' })).toBe(false);
      expect(canWriteBudget(admin, { created_by: 'other' })).toBe(true);
    });
  });
});
