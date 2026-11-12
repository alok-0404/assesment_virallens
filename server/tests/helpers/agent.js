import request from 'supertest';

/** Supertest agent that keeps cookies and knows its CSRF token. */
export async function createAgent(app) {
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/csrf-token');
  const csrfToken = res.body.data.csrfToken;

  return {
    agent,
    csrfToken,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrfToken).send(body),
    del: (url) => agent.delete(url).set('X-CSRF-Token', csrfToken),
  };
}

let counter = 0;
export function uniqueUser(overrides = {}) {
  counter += 1;
  return {
    name: `Test User ${counter}`,
    email: `user${counter}_${Date.now()}@example.com`,
    password: 'Password123',
    ...overrides,
  };
}

export async function signedInAgent(app, overrides) {
  const client = await createAgent(app);
  const credentials = uniqueUser(overrides);
  const res = await client.post('/api/auth/signup', credentials);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...client, user: res.body.data.user, credentials };
}
