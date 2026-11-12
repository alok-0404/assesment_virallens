import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { testEnv, TEST_JWT_SECRET } from './helpers/env.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db.js';
import { createAgent, signedInAgent, uniqueUser } from './helpers/agent.js';

const env = testEnv();
const app = createApp(env);

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

function cookieHeader(res, name) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));
}

describe('CSRF protection', () => {
  it('issues a token and an HttpOnly csrf cookie', async () => {
    const res = await request(app).get('/api/auth/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const cookie = cookieHeader(res, 'csrf_token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('reuses an existing valid token (multi-tab safe)', async () => {
    const client = await createAgent(app);
    const res = await client.get('/api/auth/csrf-token');
    expect(res.body.data.csrfToken).toBe(client.csrfToken);
  });

  it('rejects mutating requests without a token', async () => {
    const res = await request(app).post('/api/auth/signup').send(uniqueUser());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a header token that does not match the cookie', async () => {
    const client = await createAgent(app);
    const res = await client.agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', 'a'.repeat(64))
      .send(uniqueUser());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a header token when the cookie is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-CSRF-Token', 'a'.repeat(64))
      .send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/signup', () => {
  it('creates a user, returns the public profile and sets the auth cookie', async () => {
    const client = await createAgent(app);
    const credentials = uniqueUser({ email: '  Mixed.Case@Example.COM ' });
    const res = await client.post('/api/auth/signup', credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      name: credentials.name,
      email: 'mixed.case@example.com',
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const cookie = cookieHeader(res, 'access_token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).not.toContain('Secure');
  });

  it('stores a bcrypt hash, never the plaintext password', async () => {
    const client = await createAgent(app);
    const credentials = uniqueUser();
    await client.post('/api/auth/signup', credentials);
    const stored = await User.findOne({ email: credentials.email }).select('+passwordHash').lean();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain(credentials.password);
    expect(Object.values(stored)).not.toContain(credentials.password);
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    const client = await createAgent(app);
    const credentials = uniqueUser();
    await client.post('/api/auth/signup', credentials);
    const res = await client.post('/api/auth/signup', {
      ...credentials,
      email: credentials.email.toUpperCase(),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('rejects an invalid email', async () => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/signup', uniqueUser({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual({ path: 'email', message: 'Please enter a valid email address.' });
  });

  it.each([
    ['short1', 'Password must be at least 8 characters.'],
    ['allletters', 'Password must contain at least one number.'],
    ['12345678', 'Password must contain at least one letter.'],
  ])('rejects weak password %s', async (password, message) => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/signup', uniqueUser({ password }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: 'password', message });
  });

  it('rejects missing fields and unknown fields', async () => {
    const client = await createAgent(app);
    const missing = await client.post('/api/auth/signup', {});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'password']);

    const extra = await client.post('/api/auth/signup', { ...uniqueUser(), role: 'admin' });
    expect(extra.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and sets the cookie', async () => {
    const { credentials } = await signedInAgent(app);
    const client = await createAgent(app);
    const res = await client.post('/api/auth/login', {
      email: credentials.email.toUpperCase(),
      password: credentials.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(cookieHeader(res, 'access_token')).toContain('HttpOnly');

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(credentials.email);
  });

  it('returns a generic 401 for a wrong password', async () => {
    const { credentials } = await signedInAgent(app);
    const client = await createAgent(app);
    const res = await client.post('/api/auth/login', { email: credentials.email, password: 'Wrong12345' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    expect(cookieHeader(res, 'access_token')).toBeUndefined();
  });

  it('returns the same generic 401 for an unknown email', async () => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/login', { email: 'nobody@example.com', password: 'Password123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates the login body', async () => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/login', { email: 'bad', password: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me and protected access', () => {
  it('returns the current user for a valid session', async () => {
    const client = await signedInAgent(app);
    const res = await client.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual(client.user);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'access_token=not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const client = await signedInAgent(app);
    const expired = jwt.sign(
      { sub: client.user.id, exp: Math.floor(Date.now() / 1000) - 60 },
      TEST_JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const res = await request(app).get('/api/auth/me').set('Cookie', `access_token=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const client = await signedInAgent(app);
    const forged = jwt.sign({ sub: client.user.id }, 'another-secret-another-secret-123456', { algorithm: 'HS256' });
    const res = await request(app).get('/api/auth/me').set('Cookie', `access_token=${forged}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unsigned (alg=none) token', async () => {
    const client = await signedInAgent(app);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: client.user.id })).toString('base64url');
    const res = await request(app).get('/api/auth/me').set('Cookie', `access_token=${header}.${body}.`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the user no longer exists', async () => {
    const ghostId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ sub: ghostId }, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const res = await request(app).get('/api/auth/me').set('Cookie', `access_token=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie and ends the session', async () => {
    const client = await signedInAgent(app);
    const res = await client.post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ loggedOut: true });
    expect(cookieHeader(res, 'access_token')).toMatch(/Expires=Thu, 01 Jan 1970/);

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('is idempotent without a session', async () => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  it('accepts the empty JSON object body the client sends', async () => {
    const client = await signedInAgent(app);
    const res = await client.post('/api/auth/logout', {});
    expect(res.status).toBe(200);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a literal JSON null body without ending the session', async () => {
    const client = await signedInAgent(app);
    const res = await client.agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', client.csrfToken)
      .set('Content-Type', 'application/json')
      .send('null');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect((await client.get('/api/auth/me')).status).toBe(200);
  });

  it('requires a CSRF token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(403);
  });
});

describe('cookie configuration', () => {
  it('marks cookies Secure and applies SameSite from config', async () => {
    const secureApp = createApp(testEnv({ COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'strict' }));
    const res = await request(secureApp).get('/api/auth/csrf-token');
    const cookie = cookieHeader(res, 'csrf_token');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
  });
});

describe('auth rate limiting', () => {
  it('returns 429 after too many login attempts', async () => {
    const limitedApp = createApp(testEnv({ AUTH_RATE_LIMIT_MAX: '3' }));
    const client = await createAgent(limitedApp);
    const attempt = () => client.post('/api/auth/login', { email: 'x@example.com', password: 'Password1' });
    await attempt();
    await attempt();
    await attempt();
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers.ratelimit ?? res.headers['ratelimit-policy']).toBeDefined();
  });
});
