import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { useRenewalRequests } from './useRenewalRequests';
import { decisionReceipt, renewalRow } from '../utils/prescriptionRenewals.test-fixtures';
const identity = vi.hoisted(() => ({ userId: 'owner-A', token: 'token-A' }));
vi.mock('../api', () => ({ getSession: () => ({ ...identity }), default: { get: vi.fn() } }));
const page = (items = [renewalRow()], next_cursor: string | null = null) => ({ data: { items, next_cursor } });
function deferred() { let resolve!: (value: ReturnType<typeof page>) => void; const promise = new Promise<ReturnType<typeof page>>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { vi.resetAllMocks(); identity.userId = 'owner-A'; identity.token = 'token-A'; vi.mocked(api.get).mockResolvedValue(page()); });
it('requests bounded pages, deduplicates overlaps and preserves loaded data on continuation failure', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(page([renewalRow()], 'cursor-1')).mockResolvedValueOnce(page([renewalRow(), renewalRow({ id: 'request-2' })], 'cursor-2')).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useRenewalRequests('patient')); await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => result.current.load(result.current.nextCursor!)); expect(result.current.items).toHaveLength(2);
  expect(api.get).toHaveBeenLastCalledWith('/api/v1/prescription-requests/page', { headers: { Authorization: 'Bearer token-A' }, params: { limit: 20, cursor: 'cursor-1' } });
  await act(async () => result.current.load(result.current.nextCursor!)); expect(result.current.items).toHaveLength(2); expect(result.current.nextCursor).toBe('cursor-2'); expect(result.current.error).toBeTruthy();
});
it('does not allow old-filter history to appear under the new filter', async () => {
  const old = deferred(); vi.mocked(api.get).mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([decisionReceipt().request]));
  const { result, rerender } = renderHook(({ filter }) => useRenewalRequests('doctor', filter), { initialProps: { filter: 'pending' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1)); rerender({ filter: 'all' }); await waitFor(() => expect(result.current.items[0]?.status).toBe('approved'));
  await act(async () => old.resolve(page())); expect(result.current.items[0]?.status).toBe('approved');
});
it('invalidates in-flight sibling data and mutation callbacks on authority loss; only explicit fresh read restores', async () => {
  const old = deferred(); vi.mocked(api.get).mockReturnValueOnce(old.promise).mockResolvedValueOnce(page());
  const { result } = renderHook(() => useRenewalRequests('doctor')); await waitFor(() => expect(api.get).toHaveBeenCalled());
  const pendingAction = result.current.capture(); act(() => { result.current.invalidateAccess({ response: { status: 403 } }); });
  await act(async () => old.resolve(page())); expect(result.current.accessLost).toBe(true); expect(result.current.items).toEqual([]); expect(pendingAction()).toBe(false);
  await act(async () => result.current.load()); expect(result.current.accessLost).toBe(false); expect(result.current.items).toHaveLength(1); expect(pendingAction()).toBe(false);
});
it('keeps history available on write-consent denial but clears it on genuine authority denial', async () => {
  const { result } = renderHook(() => useRenewalRequests('patient')); await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => { expect(result.current.invalidateAccess({ response: { status: 403, data: { detail: { code: 'consent_required' } } } })).toBe(false); }); expect(result.current.items).toHaveLength(1);
  act(() => { result.current.invalidateAccess({ response: { status: 401 } }); }); expect(result.current.items).toEqual([]);
});
it('does not let a stale first page overwrite an acknowledged clinician decision', async () => {
  const old = deferred(); vi.mocked(api.get).mockReturnValue(old.promise);
  const { result } = renderHook(() => useRenewalRequests('doctor', 'all')); await waitFor(() => expect(api.get).toHaveBeenCalled());
  act(() => result.current.apply(decisionReceipt().request)); await act(async () => old.resolve(page()));
  expect(result.current.items[0]?.status).toBe('approved'); expect(result.current.loading).toBe(false);
});
it('marks an expired continuation for explicit restart and ignores a reply after account replacement', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(page([renewalRow()], 'expired')).mockRejectedValueOnce({ response: { status: 422 } });
  const { result } = renderHook(() => useRenewalRequests('patient')); await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => result.current.load('expired')); expect(result.current.restartRequired).toBe(true); expect(result.current.items).toHaveLength(1);
  const stale = deferred(); vi.mocked(api.get).mockReturnValue(stale.promise); let reading!: Promise<void>; act(() => { reading = result.current.load(); });
  identity.userId = 'owner-B'; identity.token = 'token-B'; await act(async () => { stale.resolve(page([renewalRow({ medication_name: 'stale response' })])); await reading; });
  expect(result.current.items[0]?.medication_name).not.toBe('stale response'); expect(result.current.current()).toBe(false);
});
