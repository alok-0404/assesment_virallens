import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createOpenRouterClient } from '../src/services/openrouter.service.js';
import { User } from '../src/models/User.js';
import { testEnv, TEST_JWT_SECRET } from './helpers/env.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db.js';
import { createAgent, signedInAgent, uniqueUser } from './helpers/agent.js';

const aiClient = {
  complete: vi.fn(async () => ({ content: 'Happy to help.', model: 'test-model' })),
};
const app = createApp(testEnv(), { aiClient });
const someId = new mongoose.Types.ObjectId().toString();

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  aiClient.complete.mockClear();
  await clearTestDb();
});

const protectedEndpoints = [
  ['get', '/api/auth/me'],
  ['post', '/api/chat/send', { message: 'hello' }],
  ['get', '/api/chat/history'],
  ['get', `/api/chat/conversations/${someId}`],
  ['get', `/api/chat/conversations/${someId}/messages`],
  ['delete', `/api/chat/conversations/${someId}`],
];

function call(client, method, url, body) {
  if (method === 'get') return client.get(url);
  if (method === 'delete') return client.del(url);
  return client.post(url, body);
}

describe('authentication is enforced on every protected endpoint', () => {
  it.each(protectedEndpoints)('%s %s without a session → 401', async (method, url, body) => {
    const client = await createAgent(app);
    const res = await call(client, method, url, body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  const badTokens = {
    tampered: () => {
      const [h, , s] = jwt.sign({ sub: someId }, TEST_JWT_SECRET, { algorithm: 'HS256' }).split('.');
      const payload = Buffer.from(JSON.stringify({ sub: someId, admin: true })).toString('base64url');
      return `${h}.${payload}.${s}`;
    },
    expired: () => jwt.sign({ sub: someId, exp: Math.floor(Date.now() / 1000) - 60 }, TEST_JWT_SECRET),
    'wrong secret': () => jwt.sign({ sub: someId }, 'another-secret-that-is-also-longer-than-32'),
    'alg none': () => jwt.sign({ sub: someId }, null, { algorithm: 'none' }),
    'non-ObjectId subject': () => jwt.sign({ sub: '{"$ne":null}' }, TEST_JWT_SECRET),
  };

  it.each(Object.keys(badTokens))('rejects a %s token on chat endpoints', async (kind) => {
    const res = await request(app)
      .get('/api/chat/history')
      .set('Cookie', `access_token=${badTokens[kind]()}`);
    expect(res.status).toBe(401);
  });
});

describe('CSRF', () => {
  it('rejects a token issued to a different browser session', async () => {
    const alice = await signedInAgent(app);
    const mallory = await createAgent(app);
    const res = await alice.agent
      .post('/api/chat/send')
      .set('X-CSRF-Token', mallory.csrfToken)
      .send({ message: 'forged' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    expect(aiClient.complete).not.toHaveBeenCalled();
  });
});

describe('NoSQL injection and mass assignment', () => {
  it.each([
    ['operator as email', { email: { $gt: '' }, password: 'Password123' }],
    ['operator as password', { email: 'a@example.com', password: { $ne: null } }],
    ['array as email', { email: ['a@example.com'], password: 'Password123' }],
    ['$where key', { email: 'a@example.com', password: 'Password123', $where: '1' }],
  ])('login rejects %s with 400', async (_label, body) => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/login', body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login with an operator payload cannot match an existing user', async () => {
    const client = await createAgent(app);
    await client.post('/api/auth/signup', uniqueUser());
    const res = await client.post('/api/auth/login', { email: { $regex: '.*' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
    expect(res.headers['set-cookie']?.some((c) => c.startsWith('access_token=') && !c.includes('1970'))).toBeFalsy();
  });

  it('signup rejects privileged fields (passwordHash, _id, role)', async () => {
    const client = await createAgent(app);
    const res = await client.post('/api/auth/signup', {
      ...uniqueUser(),
      passwordHash: '$2b$04$attackercontrolledhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      _id: someId,
      role: 'admin',
    });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects __proto__ keys without polluting Object.prototype', async () => {
    const client = await createAgent(app);
    const res = await client.agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', client.csrfToken)
      .set('Content-Type', 'application/json')
      .send(`{"name":"Proto User","email":"proto@example.com","password":"Password123","__proto__":{"polluted":true}}`);
    expect(res.status).toBe(400);
    expect({}.polluted).toBeUndefined();
  });

  it('does not expand bracket operators in query strings', async () => {
    const client = await signedInAgent(app);
    const res = await client.get('/api/chat/history?page[$gt]=0&limit[$ne]=1');
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('ignores a bracket operator as a message cursor', async () => {
    const client = await signedInAgent(app);
    const conversation = (await client.post('/api/chat/send', { message: 'hello' })).body.data.conversation;
    const res = await client.get(`/api/chat/conversations/${conversation.id}/messages?before[$gt]=`);
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(2);
  });

  it.each([
    ['repeated page parameter', '/api/chat/history?page=1&page=2'],
    ['repeated cursor parameter', `/api/chat/conversations/${someId}/messages?before=${someId}&before=${someId}`],
    ['operator JSON as conversation id', '/api/chat/conversations/%7B%22%24ne%22%3Anull%7D'],
  ])('rejects %s with 400', async (_label, url) => {
    const client = await signedInAgent(app);
    const res = await client.get(url);
    expect(res.status).toBe(400);
  });

  it.each([
    ['operator as conversationId', { message: 'hi', conversationId: { $ne: null } }],
    ['operator as message', { message: { $gt: '' } }],
    ['user id injection', { message: 'hi', user: someId }],
  ])('send rejects %s with 400 and never calls the AI', async (_label, body) => {
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', body);
    expect(res.status).toBe(400);
    expect(aiClient.complete).not.toHaveBeenCalled();
  });

  it('ignores a non-JSON content type instead of parsing it', async () => {
    const client = await signedInAgent(app);
    const res = await client.agent
      .post('/api/chat/send')
      .set('X-CSRF-Token', client.csrfToken)
      .set('Content-Type', 'text/plain')
      .send('message=hello');
    expect(res.status).toBe(400);
    expect(aiClient.complete).not.toHaveBeenCalled();
  });
});

describe('sensitive data never leaves the server', () => {
  it('no password hash or plaintext password in any auth response', async () => {
    const client = await createAgent(app);
    const credentials = uniqueUser();
    const responses = [
      await client.post('/api/auth/signup', credentials),
      await client.post('/api/auth/login', { email: credentials.email, password: credentials.password }),
      await client.get('/api/auth/me'),
    ];
    for (const res of responses) {
      expect(res.status).toBeLessThan(300);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/passwordHash|\$2[aby]\$/);
      expect(text).not.toContain(credentials.password);
      expect(Object.keys(res.body.data.user).sort()).toEqual(['createdAt', 'email', 'id', 'name']);
    }
  });

  it('chat responses expose no user internals', async () => {
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', { message: 'hello' });
    expect(res.status).toBe(201);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/passwordHash|\$2[aby]\$|"email"/);
  });

  it('the provider key is absent from responses when the real client fails', async () => {
    const env = testEnv({ OPENROUTER_API_KEY: 'sk-or-v1-secret-value-for-test' });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid key sk-or-v1-secret-value-for-test', code: 401 } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const realClientApp = createApp(env, { aiClient: createOpenRouterClient(env, { fetchImpl }) });
    const client = await signedInAgent(realClientApp);
    const res = await client.post('/api/chat/send', { message: 'hello' });
    expect(res.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res.body)).not.toContain('sk-or-v1-secret-value-for-test');
    expect(JSON.stringify(res.body)).not.toContain('Invalid key');
  });

  it('production errors carry no stack traces or internal messages', async () => {
    // Secure cookies are not sent back over Supertest's plain HTTP, so this test opts out of them.
    const prodApp = createApp(testEnv({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }), {
      aiClient: { complete: vi.fn(async () => { throw new Error('db password=hunter2 at internal.js:10'); }) },
    });
    const client = await signedInAgent(prodApp);
    const res = await client.agent
      .post('/api/chat/send')
      .set('X-CSRF-Token', client.csrfToken)
      .send({ message: 'hello' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|internal\.js|stack/);
  });
});

describe('cookie flags in production configuration', () => {
  it('auth and CSRF cookies are HttpOnly, Secure and SameSite=Lax', async () => {
    const prodApp = createApp(testEnv({ NODE_ENV: 'production' }), { aiClient });
    const csrfRes = await request(prodApp).get('/api/auth/csrf-token');
    const csrfCookie = csrfRes.headers['set-cookie'].find((c) => c.startsWith('csrf_token='));
    const token = csrfRes.body.data.csrfToken;

    const signup = await request(prodApp)
      .post('/api/auth/signup')
      .set('Cookie', csrfCookie.split(';')[0])
      .set('X-CSRF-Token', token)
      .send(uniqueUser());
    expect(signup.status).toBe(201);
    const authCookie = signup.headers['set-cookie'].find((c) => c.startsWith('access_token='));

    for (const cookie of [csrfCookie, authCookie]) {
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
    }
    expect(authCookie).toMatch(/Max-Age=604800/);
  });
});
