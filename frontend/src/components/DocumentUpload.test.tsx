import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUpload from './DocumentUpload';
import { I18nProvider } from '../i18n/LanguageContext';

// Mock the axios instance (default export).
vi.mock('../api', () => ({ default: { post: vi.fn() } }));
import api from '../api';
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>;

function renderUpload(props: Partial<React.ComponentProps<typeof DocumentUpload>> = {}) {
  return render(
    <I18nProvider>
      <DocumentUpload kind="diploma" {...props} />
    </I18nProvider>,
  );
}

function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('DocumentUpload', () => {
  beforeEach(() => mockPost.mockReset());

  it('renders the upload + camera buttons', () => {
    renderUpload();
    expect(screen.getByText(/carregar ficheiro|upload file/i)).toBeInTheDocument();
    expect(screen.getByText(/tirar foto|take photo/i)).toBeInTheDocument();
  });

  it('uploads a valid file, shows the filename, and calls onUploaded', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'ev1' } });
    const onUploaded = vi.fn();
    const { container } = renderUpload({ onUploaded });
    pickFile(container, new File([new Uint8Array([1, 2, 3])], 'licence.pdf', { type: 'application/pdf' }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: 'ev1' }));
    expect(mockPost).toHaveBeenCalledOnce();
    expect(screen.getByText('licence.pdf')).toBeInTheDocument();
  });

  it('posts to the default credentials endpoint keyed by kind', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const { container } = renderUpload({ kind: 'insurance' });
    pickFile(container, new File(['x'], 'ins.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0][0]).toBe('/api/v1/credentials/me/evidence/insurance');
  });

  it('honours a custom endpoint override', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const { container } = renderUpload({ endpoint: '/api/v1/caregiver/dependants/abc/evidence' });
    pickFile(container, new File(['x'], 'g.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0][0]).toBe('/api/v1/caregiver/dependants/abc/evidence');
  });

  it('rejects a file over the size limit without calling the API', async () => {
    const { container } = renderUpload({ maxBytes: 4 });
    pickFile(container, new File([new Uint8Array(10)], 'big.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByText(/10 MB|larger|maior/i)).toBeInTheDocument());
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('surfaces a server error message', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { detail: 'Documento inválido' } } });
    const { container } = renderUpload();
    pickFile(container, new File(['x'], 'bad.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByText('Documento inválido')).toBeInTheDocument());
  });
});
