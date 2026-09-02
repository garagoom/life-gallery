const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

const { authMiddleware } = require('./auth.cjs');

describe('Auth Middleware', () => {
  const mockRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  const mockNext = () => {};

  it('should reject request without token', () => {
    const req = { headers: {} };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(401);
  });

  it('should reject request with invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBe(401);
  });

  it('should accept request with valid token', () => {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBeNull();
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('admin');
  });

  it('should reject expired token', () => {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBe(401);
    expect(res.body.expired).toBe(true);
  });

  it('should handle malformed Authorization header', () => {
    const req = { headers: { authorization: 'Bearer' } };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBe(401);
  });

  it('should handle non-Bearer auth scheme', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = mockRes();
    authMiddleware(req, res, mockNext);
    expect(res.statusCode).toBe(401);
  });
});
