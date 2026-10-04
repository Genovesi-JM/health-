import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying axios instance so we test the typed wrapper in isolation.
vi.mock('../api', () => ({ default: { request: vi.fn() } }));
import api from '../api';
import { http, endpoints } from './client';

const mockRequest = api.request as unknown as ReturnType<typeof vi.fn>;

describe('typed api client', () => {
  beforeEach(() => mockRequest.mockReset());

  it('returns ok:true with data on success', async () => {
    mockRequest.mockResolvedValueOnce({ data: { id: 'p1' }, status: 200 });
    const res = await http.get<{ id: string }>(endpoints.patients.me);
    expect(res).toEqual({ ok: true, data: { id: 'p1' }, status: 200 });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/api/v1/patients/me' }));
  });

  it('unwraps a FastAPI { detail } error into ok:false', async () => {
    mockRequest.mockRejectedValueOnce({ response: { status: 401, data: { detail: 'Password incorreta.' } }, code: 'ERR_BAD_REQUEST' });
    const res = await http.post('/auth/login', { email: 'x', password: 'y' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error.message).toBe('Password incorreta.');
    }
  });

  it('builds path-param URLs from the endpoints registry', () => {
    expect(endpoints.patients.byId('abc')).toBe('/api/v1/patients/abc');
    expect(endpoints.consultations.byId('c9')).toBe('/api/v1/consultations/c9');
  });

  it('falls back to a generic message when none is provided', async () => {
    mockRequest.mockRejectedValueOnce({ message: 'Network Error' });
    const res = await http.get('/api/v1/anything');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toBe('Network Error');
  });

  it('converts validation details into renderable text', async () => {
    mockRequest.mockRejectedValueOnce({ response: { status: 422, data: {
      detail: [{ msg: 'Selecione o país.' }, null, { msg: 'Indique uma data.' }],
    } } });
    const res = await http.post('/api/v1/example');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(422);
      expect(res.error.message).toBe('Selecione o país. Indique uma data.');
    }
  });

  it.each([null, 'failed', { response: { status: '401', data: { message: {} } }, code: {} }])(
    'handles malformed thrown values without returning objects as UI messages: %j', async failure => {
      mockRequest.mockRejectedValueOnce(failure);
      const res = await http.get('/api/v1/example');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(0);
        expect(res.error.message).toBe('Request failed');
        expect(res.error.code).toBeUndefined();
      }
    },
  );
});
