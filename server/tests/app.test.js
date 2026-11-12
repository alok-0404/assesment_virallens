import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';
import { logger } from '../src/utils/logger.js';
import { testEnv } from './helpers/env.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';

const env = testEnv();
const app = createApp(env);

function fakeRes() {
  const res = { headersSent: false, headers: {} };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.set = vi.fn((k, v) => {
    res.headers[k] = v;
    return res;
  });
  return res;
}

describe('health endpoint', () => {
  it('returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.data.database).toBe('disconnected');
  });

  describe('with MongoDB connected', () => {
    beforeAll(connectTestDb);
    afterAll(disconnectTestDb);

    it('returns 200 with database connected', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { status: 'ok', database: 'connected' } });
    });
  });
});

describe('application middleware', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/does-not-exist not found.' },
    });
  });

  it('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('logs requests rejected by the JSON body parser', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    try {
      const devApp = createApp(testEnv({ NODE_ENV: 'development' }));
      const res = await request(devApp)
        .post('/api/auth/logout?x=1')
        .set('Content-Type', 'application/json')
        .send('null');
      expect(res.status).toBe(400);
      await vi.waitFor(() =>
        expect(info).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/auth\/logout 400 /)),
      );
    } finally {
      info.mockRestore();
    }
  });

  it('rejects bodies larger than 100kb with 413', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('marks every API response as non-cacheable', async () => {
    const ok = await request(app).get('/api/health');
    const missing = await request(app).get('/api/does-not-exist');
    const forbidden = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    for (const res of [ok, missing, forbidden]) {
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows configured CORS origins with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects disallowed CORS origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_FORBIDDEN');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('applies the global rate limiter', async () => {
    const limited = createApp(testEnv({ RATE_LIMIT_MAX: '2' }));
    await request(limited).get('/api/health');
    await request(limited).get('/api/health');
    const res = await request(limited).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('error handler', () => {
  const handler = createErrorHandler(env);
  const req = { method: 'GET', originalUrl: '/x?secret=1' };

  it('maps AppError to its status and code', () => {
    const res = fakeRes();
    handler(new AppError(409, 'CONFLICT', 'Nope', [{ path: 'a', message: 'b' }]), req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'CONFLICT', message: 'Nope', details: [{ path: 'a', message: 'b' }] },
    });
  });

  it('hides internals of unknown errors in production', () => {
    const prodHandler = createErrorHandler(testEnv({ NODE_ENV: 'production' }));
    const res = fakeRes();
    prodHandler(new Error('db password is hunter2'), req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('includes a stack only in development', () => {
    const devHandler = createErrorHandler(testEnv({ NODE_ENV: 'development' }));
    const res = fakeRes();
    devHandler(new Error('boom'), req, res, vi.fn());
    expect(res.json.mock.calls[0][0].error.stack).toContain('boom');
  });

  it('maps duplicate key errors to 409', () => {
    const res = fakeRes();
    handler(Object.assign(new Error('E11000'), { code: 11000 }), req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('delegates when headers were already sent', () => {
    const res = fakeRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error('late');
    handler(err, req, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
