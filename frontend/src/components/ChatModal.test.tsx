import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import ChatModal from './ChatModal';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
type Message = { id: string; sender_role: string; body: string; created_at: string };
function message(body: string): Message { return { id: body, sender_role: 'doctor', body, created_at: '2026-10-05T10:00:00Z' }; }
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

it('clears the previous consultation draft and ignores its late messages when switching consultations', async () => {
  let finishFirst!: (value: { data: Message[] }) => void;
  vi.mocked(api.get).mockImplementation(url => url.includes('/first/')
    ? new Promise(resolve => { finishFirst = resolve; })
    : Promise.resolve({ data: [message('Second consultation')] }));
  const props = { open: true, onClose: vi.fn(), myRole: 'patient' as const };
  const view = render(<ChatModal {...props} consultationId="first" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Private first draft' } });
  view.rerender(<ChatModal {...props} consultationId="second" />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(await screen.findByText('Second consultation')).toBeInTheDocument();
  await act(async () => finishFirst({ data: [message('Private first message')] }));
  expect(screen.queryByText('Private first message')).not.toBeInTheDocument();
  expect(screen.getByText('Second consultation')).toBeInTheDocument();
});
