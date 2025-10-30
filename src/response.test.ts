import { describe, it, expect } from 'vitest';
import { json } from './response';

describe('json', () => {
  it('returns a structured API Gateway response', () => {
    const response = json(201, { ok: true });

    expect(response.statusCode).toBe(201);
    expect(response.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    expect(response.body).toBe('{"ok":true}');
  });

  it('omits body and content type for 204 responses', () => {
    const response = json(204);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
    });
    expect(response.body).toBeUndefined();
  });
});
