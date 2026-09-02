const { describe, it, expect } = require('vitest');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

const { requireEditor, requireAdmin } = require('./permission.cjs');

describe('Permission Middleware', () => {
  const mockRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  const mockNext = () => {};

  describe('requireEditor', () => {
    it('should allow admin role', () => {
      const req = { user: { role: 'admin' } };
      const res = mockRes();
      requireEditor(req, res, mockNext);
      expect(res.statusCode).toBeNull();
    });

    it('should allow editor role', () => {
      const req = { user: { role: 'editor' } };
      const res = mockRes();
      requireEditor(req, res, mockNext);
      expect(res.statusCode).toBeNull();
    });

    it('should reject viewer role', () => {
      const req = { user: { role: 'viewer' } };
      const res = mockRes();
      requireEditor(req, res, mockNext);
      expect(res.statusCode).toBe(403);
    });

    it('should reject when no user', () => {
      const req = {};
      const res = mockRes();
      requireEditor(req, res, mockNext);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin role', () => {
      const req = { user: { role: 'admin' } };
      const res = mockRes();
      requireAdmin(req, res, mockNext);
      expect(res.statusCode).toBeNull();
    });

    it('should reject editor role', () => {
      const req = { user: { role: 'editor' } };
      const res = mockRes();
      requireAdmin(req, res, mockNext);
      expect(res.statusCode).toBe(403);
    });

    it('should reject viewer role', () => {
      const req = { user: { role: 'viewer' } };
      const res = mockRes();
      requireAdmin(req, res, mockNext);
      expect(res.statusCode).toBe(403);
    });
  });
});
