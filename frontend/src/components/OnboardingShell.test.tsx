import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnboardingShell, { type OnboardingStepDef } from './OnboardingShell';
import { I18nProvider } from '../i18n/LanguageContext';

vi.mock('../api', () => ({ default: { post: vi.fn(), put: vi.fn() } }));
import api from '../api';
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>;
const mockPut = api.put as unknown as ReturnType<typeof vi.fn>;

const DRAFT = {
  id: 'd1', role: 'patient', status: 'draft',
  current_step: 1, total_steps: 2, completed_steps: [], data: {},
};

const STEPS: OnboardingStepDef[] = [
  {
    key: 'one', title: 'Step One',
    render: (ctx) => (
      <input aria-label="name" value={(ctx.data.name as string) ?? ''} onChange={e => ctx.setField('name', e.target.value)} />
    ),
    validate: (d) => (d.name ? null : 'name required'),
  },
  { key: 'two', title: 'Step Two', render: () => <div>second step body</div> },
];

function renderShell(onSubmitted = vi.fn()) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <OnboardingShell role="patient" steps={STEPS} onSubmitted={onSubmitted} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('OnboardingShell', () => {
  beforeEach(() => {
    mockPost.mockReset(); mockPut.mockReset();
    // /start resolves the initial draft; /save (autosave) resolves quietly.
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/onboarding/start')) return Promise.resolve({ data: DRAFT });
      if (url.includes('/onboarding/save')) return Promise.resolve({ data: {} });
      if (url.includes('/onboarding/submit')) return Promise.resolve({ data: { ...DRAFT, status: 'submitted' } });
      return Promise.resolve({ data: {} });
    });
  });

  it('starts the draft and shows the first step + progress', async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText('Step One')).toBeInTheDocument());
    // "Passo 1 de 2" (pt default)
    expect(screen.getByText(/1/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('blocks advancing when step validation fails', async () => {
    renderShell();
    await waitFor(() => screen.getByText('Step One'));
    fireEvent.click(screen.getByTestId("onboarding-primary"));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('name required'));
    // Still on step one; PUT never fired.
    expect(mockPut).not.toHaveBeenCalled();
    expect(screen.getByText('Step One')).toBeInTheDocument();
  });

  it('advances to the next step when the field is valid', async () => {
    mockPut.mockResolvedValue({ data: { ...DRAFT, current_step: 2, completed_steps: [1], data: { '1': { name: 'Ana' } } } });
    renderShell();
    await waitFor(() => screen.getByText('Step One'));
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId("onboarding-primary"));
    await waitFor(() => expect(screen.getByText('second step body')).toBeInTheDocument());
    expect(mockPut).toHaveBeenCalledWith('/api/v1/onboarding/steps/1', expect.objectContaining({ completed: true }));
  });

  it('submits on the final step and calls onSubmitted', async () => {
    // Start already on the last step.
    mockPost.mockImplementation((url: string) => {
      if (url.includes('/onboarding/start')) return Promise.resolve({ data: { ...DRAFT, current_step: 2 } });
      if (url.includes('/onboarding/submit')) return Promise.resolve({ data: { ...DRAFT, status: 'submitted' } });
      return Promise.resolve({ data: {} });
    });
    mockPut.mockResolvedValue({ data: { ...DRAFT, current_step: 2, completed_steps: [1, 2] } });
    const onSubmitted = vi.fn();
    renderShell(onSubmitted);
    await waitFor(() => screen.getByText('Step Two'));
    fireEvent.click(screen.getByTestId("onboarding-primary"));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/api/v1/onboarding/submit');
  });
});
