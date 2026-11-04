import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import { useUnreadNotifications } from './useUnreadNotifications';
import { notifyInboxChanged } from '../utils/notifications';
const auth = vi.hoisted(() => ({ user: { id: 'owner-1' } as { id: string } | null }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ default: { get: vi.fn() } }));
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'owner-1' }; vi.mocked(api.get).mockResolvedValue({ data: { unread: 7 } }); });
describe('notification badge account lifecycle', () => {
  it('clears on logout and ignores a late response from the logged-out account', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(() => useUnreadNotifications());
    auth.user = null; rerender(); expect(result.current).toBe(0);
    await act(async () => { resolve({ data: { unread: 9 } }); });
    expect(result.current).toBe(0);
  });
  it('never displays the previous account count after switching accounts', async () => {
    const { result, rerender } = renderHook(() => useUnreadNotifications());
    await waitFor(() => expect(result.current).toBe(7));
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise(done => { resolve = done; }));
    auth.user = { id: 'owner-2' }; rerender(); expect(result.current).toBe(0);
    act(() => notifyInboxChanged('owner-1', 99)); expect(result.current).toBe(0);
    await act(async () => { resolve({ data: { unread: 2 } }); }); expect(result.current).toBe(2);
  });
  it('refreshes on focus and keeps the last confirmed count on a read failure', async () => {
    const { result } = renderHook(() => useUnreadNotifications()); await waitFor(() => expect(result.current).toBe(7));
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { window.dispatchEvent(new Event('focus')); }); expect(result.current).toBe(7);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { unread: 3 } });
    await act(async () => { window.dispatchEvent(new Event('focus')); }); expect(result.current).toBe(3);
  });
  it('uses an authoritative inbox update and ignores an older outstanding poll', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useUnreadNotifications());
    act(() => notifyInboxChanged('owner-1', 1)); expect(result.current).toBe(1);
    await act(async () => { resolve({ data: { unread: 20 } }); }); expect(result.current).toBe(1);
  });
});
