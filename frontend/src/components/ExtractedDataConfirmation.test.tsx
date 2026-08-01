import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractedDataConfirmation, { type ExtractedField } from './ExtractedDataConfirmation';
import { I18nProvider } from '../i18n/LanguageContext';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const FIELDS: ExtractedField[] = [
  { key: 'name', label: 'Nome', extractedValue: 'Ana Manuel', confidence: 0.95 },
  { key: 'licence', label: 'Cédula', extractedValue: 'AO-123', confidence: 0.5 },
];

describe('ExtractedDataConfirmation', () => {
  it('renders each field with its extracted value + confidence', () => {
    renderWithI18n(
      <ExtractedDataConfirmation fields={FIELDS} onConfirm={() => {}} onMarkIncorrect={() => {}} />,
    );
    expect(screen.getByText('Ana Manuel')).toBeInTheDocument();
    expect(screen.getByText('AO-123')).toBeInTheDocument();
    // Confidence percentages rendered.
    expect(screen.getByText(/95%/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('confirm passes the (possibly edited) values back', () => {
    const onConfirm = vi.fn();
    renderWithI18n(
      <ExtractedDataConfirmation fields={FIELDS} onConfirm={onConfirm} onMarkIncorrect={() => {}} />,
    );
    // Edit the licence input, then confirm.
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'AO-999' } });
    fireEvent.click(screen.getByText(/confirmar/i));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ name: 'Ana Manuel', licence: 'AO-999' });
  });

  it('mark-incorrect fires its callback', () => {
    const onMarkIncorrect = vi.fn();
    renderWithI18n(
      <ExtractedDataConfirmation fields={FIELDS} onConfirm={() => {}} onMarkIncorrect={onMarkIncorrect} />,
    );
    fireEvent.click(screen.getByText(/incorreta|incorrect/i));
    expect(onMarkIncorrect).toHaveBeenCalledTimes(1);
  });

  it('surfaces a low-confidence warning when any field is under 70%', () => {
    renderWithI18n(
      <ExtractedDataConfirmation fields={FIELDS} onConfirm={() => {}} onMarkIncorrect={() => {}} />,
    );
    // The 0.5 field should trigger the low-confidence notice (specific copy).
    expect(screen.getByText(/baixa confiança|low confidence/i)).toBeInTheDocument();
  });

  it('does NOT show the low-confidence warning when all fields are high-confidence', () => {
    const highOnly: ExtractedField[] = [
      { key: 'name', label: 'Nome', extractedValue: 'Ana', confidence: 0.99 },
    ];
    renderWithI18n(
      <ExtractedDataConfirmation fields={highOnly} onConfirm={() => {}} onMarkIncorrect={() => {}} />,
    );
    expect(screen.queryByText(/baixa confiança|low confidence/i)).not.toBeInTheDocument();
  });
});
