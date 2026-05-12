import request from 'supertest';
import { createApp } from './app';

describe('Moodie API app', () => {
  it('returns the health response', async () => {
    const app = createApp();

    const res = await request(app).get('/').expect(200);

    expect(res.text).toBe('Moodie API is running...');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns a structured 404 response', async () => {
    const app = createApp();

    const res = await request(app).get('/missing-route').expect(404);

    expect(res.body.message).toBe('Endpoint not found');
    expect(res.body.requestId).toBeTruthy();
  });
});
