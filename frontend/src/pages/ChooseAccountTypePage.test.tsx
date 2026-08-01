import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChooseAccountTypePage from './ChooseAccountTypePage';
import { I18nProvider } from '../i18n/LanguageContext';

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ChooseAccountTypePage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('ChooseAccountTypePage', () => {
  it('renders the "how will you use Kaya" heading', () => {
    renderPage();
    // pt default
    expect(screen.getByText(/como vai usar o kaya/i)).toBeInTheDocument();
  });

  it('renders all five account-type choices', () => {
    renderPage();
    expect(screen.getByText(/preciso de cuidados de saúde/i)).toBeInTheDocument();     // patient
    expect(screen.getByText(/estou a registar-me por um familiar/i)).toBeInTheDocument(); // caregiver
    expect(screen.getByText(/sou profissional de saúde/i)).toBeInTheDocument();        // professional
    expect(screen.getByText(/represento uma clínica ou laboratório/i)).toBeInTheDocument(); // clinic
    expect(screen.getByText(/represento uma farmácia/i)).toBeInTheDocument();          // pharmacy
  });

  it('offers a sign-in link for existing users', () => {
    renderPage();
    const signIn = screen.getByRole('link', { name: /entrar/i });
    expect(signIn).toHaveAttribute('href', '/login');
  });
});
