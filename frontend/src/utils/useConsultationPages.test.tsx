import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import { useConsultationPages } from './useConsultationPages';
const actor = vi.hoisted(() => ({ userId: 'patient-one' }));
vi.mock('../api', () => ({ default: { get: vi.fn() }, getSession: () => actor }));
beforeEach(() => { vi.resetAllMocks(); actor.userId = 'patient-one'; });
type Item = { id: string; status: string };
const page = (items: Item[], next: string | null = null) => ({ data: { items, next_cursor: next } });

it('keeps records and next cursor after a failed page, then deduplicates the retry', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'one', status: 'requested' }], 'opaque-position'));
  const { result } = renderHook(() => useConsultationPages<Item>('/visits/page', 'all'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'));
  await act(() => result.current.loadMore());
  expect(result.current.items).toHaveLength(1); expect(result.current.nextCursor).toBe('opaque-position');
  expect(result.current.moreError).toContain('Tente novamente');
  vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'one', status: 'scheduled' }, { id: 'two', status: 'completed' }]));
  await act(() => result.current.loadMore());
  expect(result.current.items).toEqual([{ id: 'one', status: 'scheduled' }, { id: 'two', status: 'completed' }]);
  expect(api.get).toHaveBeenLastCalledWith('/visits/page', { params: { limit: 20, view: 'all', cursor: 'opaque-position' } });
  expect(result.current.nextCursor).toBeNull();
});

it('filters on the server and rejects a late page from the previous view', async () => {
  let oldReply!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { oldReply = resolve; }));
  const { result, rerender } = renderHook(({ view }) => useConsultationPages<Item>('/visits/page', view), { initialProps: { view: 'all' } });
  vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'past', status: 'completed' }]));
  rerender({ view: 'past' });
  await waitFor(() => expect(result.current.items[0]?.id).toBe('past'));
  await act(async () => oldReply(page([{ id: 'old-view', status: 'requested' }], 'old-cursor')));
  expect(result.current.items[0].id).toBe('past'); expect(result.current.nextCursor).toBeNull();
  expect(api.get).toHaveBeenLastCalledWith('/visits/page', { params: { limit: 20, view: 'past' } });
});

it('does not expose a late response from the previous account', async () => {
  let reply!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }));
  const { result, rerender } = renderHook(() => useConsultationPages<Item>('/visits/page'));
  actor.userId = 'patient-two'; vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'owned-by-two', status: 'requested' }]));
  rerender(); await waitFor(() => expect(result.current.items[0]?.id).toBe('owned-by-two'));
  await act(async () => reply(page([{ id: 'private-one', status: 'completed' }])));
  expect(result.current.items.map(item => item.id)).toEqual(['owned-by-two']);
});

it('clears items on authorization loss and allows refresh after an invalid cursor', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'one', status: 'scheduled' }], 'position'));
  const { result } = renderHook(() => useConsultationPages<Item>('/visits/page'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 422 } });
  await act(() => result.current.loadMore());
  expect(result.current.moreError).toContain('Atualize'); expect(result.current.items).toHaveLength(1);
  vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 403 } });
  await act(() => result.current.refresh());
  expect(result.current.items).toEqual([]); expect(result.current.nextCursor).toBeNull(); expect(result.current.error).toContain('acesso mudou');
});
