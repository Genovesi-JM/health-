import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/LanguageContext';
import api from '../api';
import OnboardingShell, { type OnboardingStepDef } from './OnboardingShell';

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const submitted = vi.fn();
const exited = vi.fn();
const draft = (extra = {}) => ({ id: 'draft-1', role: 'patient', status: 'draft', current_step: 1,
  total_steps: 1, completed_steps: [], data: {}, completion_status: 'incomplete', ...extra });
const steps: OnboardingStepDef[] = [{ key: 'profile', title: 'Test profile', render: ctx => (
  <input aria-label="Name" value={String(ctx.data.name ?? '')} onChange={e => ctx.setField('name', e.target.value)} />
) }];

function show(definitions = steps) {
  render(<I18nProvider><MemoryRouter><OnboardingShell role="patient" steps={definitions}
    onSubmitted={submitted} onExit={exited} /></MemoryRouter></I18nProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(api.get).mockResolvedValue({ data: { draft: null } });
  vi.mocked(api.post).mockImplementation(async url => ({ data: String(url).includes('/submit')
    ? draft({ status: 'submitted', completion_status: 'complete' }) : draft() }));
  vi.mocked(api.put).mockResolvedValue({ data: draft({ completed_steps: [1] }) });
});
afterEach(() => vi.useRealTimers());

describe('onboarding persistence', () => {
  it('shows progress and blocks advancing when local validation fails', async () => {
    show([{ ...steps[0], validate: data => data.name ? null : 'Name is required.' }]);
    await screen.findByLabelText('Name');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('advances using returned data and preserves answers when going back', async () => {
    const twoSteps = [steps[0], { ...steps[0], key: 'second', title: 'Second step' }];
    vi.mocked(api.put).mockResolvedValue({ data: draft({ current_step: 2, total_steps: 2,
      completed_steps: [1], data: { '1': { name: 'Ana' }, '2': { name: 'Stored second answer' } } }) });
    show(twoSteps);
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByText('Second step');
    expect(screen.getByLabelText('Name')).toHaveValue('Stored second answer');
    vi.mocked(api.post).mockResolvedValue({ data: { saved: true } });
    fireEvent.click(screen.getByRole('button', { name: /Voltar|Back/ }));
    await screen.findByText('Test profile');
    expect(screen.getByLabelText('Name')).toHaveValue('Ana');
    expect(api.post).toHaveBeenCalledWith('/api/v1/onboarding/save?role=patient', {
      step: 2, data: { name: 'Stored second answer' },
    });
  });

  it('uses the selected role on every write and submits only once while pending', async () => {
    let release!: () => void;
    vi.mocked(api.put).mockImplementation(() => new Promise(resolve => {
      release = () => resolve({ data: draft({ completed_steps: [1] }) });
    }));
    show();
    await screen.findByLabelText('Name');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/v1/onboarding/steps/1?role=patient', { data: { name: 'Ana' }, completed: true });
    expect(screen.getByTestId('onboarding-primary')).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/api/v1/onboarding/submit?role=patient');
  });

  it('reopens completed onboarding without attempting to create another draft', async () => {
    const complete = draft({ status: 'submitted', completion_status: 'complete' });
    vi.mocked(api.get).mockResolvedValue({ data: { draft: complete } });
    show();
    await waitFor(() => expect(submitted).toHaveBeenCalledWith(complete));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('resumes a legacy submitted draft whose profile was never completed', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { draft: draft({ status: 'submitted' }) } });
    show();
    await screen.findByLabelText('Name');
    expect(api.post).toHaveBeenCalledWith('/api/v1/onboarding/start', { role: 'patient' });
    expect(submitted).not.toHaveBeenCalled();
  });

  it('shows server field errors without claiming submission succeeded', async () => {
    vi.mocked(api.post).mockImplementation(async url => {
      if (String(url).includes('/submit')) throw { response: { data: { detail: {
        message: 'Review your profile', fields: { '3.dob': 'Enter a valid birth date.' },
      } } } };
      return { data: draft() };
    });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid birth date.');
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByTestId('onboarding-primary')).toBeEnabled();
  });

  it('stays on the form if save-and-exit fails', async () => {
    vi.mocked(api.post).mockImplementation(async url => {
      if (String(url).includes('/save')) throw new Error('offline');
      return { data: draft() };
    });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByRole('button', { name: /Guardar e continuar depois|Save and continue later/ }));
    await screen.findByRole('alert');
    expect(exited).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/api/v1/onboarding/save?role=patient', { step: 1, data: {} });
  });

  it('retries account refresh after a successful submit without writing a frozen draft', async () => {
    submitted.mockRejectedValueOnce(new Error('temporary account refresh failure')).mockResolvedValue(undefined);
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(submitted).toHaveBeenCalledTimes(2));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.includes('/submit'))).toHaveLength(1);
  });

  it.each(['submit', 'save-and-exit'])('reconciles a lost successful submission before %s can write again', async action => {
    vi.mocked(api.post).mockImplementation(async url => {
      if (String(url).includes('/submit')) throw new Error('Submission response was lost');
      return { data: draft() };
    });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByRole('alert');
    const complete = draft({ status: 'submitted', completion_status: 'complete' });
    vi.mocked(api.get).mockResolvedValue({ data: { draft: complete } });
    fireEvent.click(action === 'submit' ? screen.getByTestId('onboarding-primary')
      : screen.getByRole('button', { name: /Guardar e continuar depois|Save and continue later/ }));
    await waitFor(() => expect(submitted).toHaveBeenCalledWith(complete));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.includes('/submit'))).toHaveLength(1);
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.includes('/save'))).toHaveLength(0);
    expect(exited).not.toHaveBeenCalled();
  });

  it('does not write again until an uncertain submission can be read back', async () => {
    vi.mocked(api.post).mockImplementation(async url => {
      if (String(url).includes('/submit')) throw new Error('Submission response was lost');
      return { data: draft() };
    });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByRole('alert');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Still offline'))
      .mockResolvedValue({ data: { draft: draft({ status: 'submitted', completion_status: 'complete' }) } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('onboarding-primary')).toBeEnabled();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('retries normally when readback confirms that a lost submission did not commit', async () => {
    let firstSubmission = true;
    vi.mocked(api.post).mockImplementation(async url => {
      if (String(url).includes('/submit')) {
        if (firstSubmission) { firstSubmission = false; throw new Error('Disconnected before commit'); }
        return { data: draft({ status: 'submitted', completion_status: 'complete' }) };
      }
      return { data: draft() };
    });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByRole('alert');
    vi.mocked(api.get).mockResolvedValue({ data: { draft: draft() } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.includes('/submit'))).toHaveLength(2);
  });

  it('reconciles when a concurrent completion freezes the draft before the final save', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 409, data: { detail: 'Already submitted' } } });
    show();
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await screen.findByRole('alert');
    vi.mocked(api.get).mockResolvedValue({ data: { draft: draft({ status: 'submitted', completion_status: 'complete' }) } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.includes('/submit'))).toHaveLength(0);
  });

  it('waits for an older autosave before persisting the final values', async () => {
    show();
    await screen.findByLabelText('Name');
    vi.useFakeTimers();
    let release!: () => void;
    vi.mocked(api.post).mockImplementation(url => {
      if (String(url).includes('/save')) return new Promise(resolve => {
        release = () => resolve({ data: draft() });
      });
      return Promise.resolve({ data: draft({ status: 'submitted', completion_status: 'complete' }) });
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(901); });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana Maria' } });
    fireEvent.click(screen.getByTestId('onboarding-primary'));
    expect(api.put).not.toHaveBeenCalled();
    await act(async () => release());
    expect(api.put).toHaveBeenCalledWith('/api/v1/onboarding/steps/1?role=patient', {
      data: { name: 'Ana Maria' }, completed: true,
    });
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});
