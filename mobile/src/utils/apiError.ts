import { AxiosError } from 'axios';

type ValidationIssue = {
  loc?: Array<string | number>;
  msg?: string;
};

export function apiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string | ValidationIssue[] }>;
  const detail = axiosError.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map(issue => {
        const field = issue.loc?.at(-1);
        return [field, issue.msg].filter(Boolean).join(': ');
      })
      .filter(Boolean);
    if (messages.length) return messages.join('\n');
  }
  return axiosError.message || fallback;
}
