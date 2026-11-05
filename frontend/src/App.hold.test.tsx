import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./LegacyApp', () => ({ default: () => { throw new Error('Operational app loaded during HOLD'); } }));
afterEach(() => vi.unstubAllEnvs());

it('renders information only without login or registration inputs during HOLD', () => {
  vi.stubEnv('VITE_OPERATIONAL_HOLD', 'true');
  render(<App />);
  expect(screen.getByText('Information only')).toBeInTheDocument();
  expect(screen.getByText('Do not send personal or health information.')).toBeInTheDocument();
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /login|regist|sign in/i })).not.toBeInTheDocument();
});
