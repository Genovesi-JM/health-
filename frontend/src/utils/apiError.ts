function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** Read an HTTP status without assuming every thrown value is an Axios error. */
export function apiErrorStatus(error: unknown): number | undefined {
  const status = record(record(error)?.response)?.status;
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
}

export const SERVER_UNREACHABLE_MESSAGE =
  'Não foi possível contactar o servidor KAYA. O portal clínico ainda não está ligado publicamente; tente mais tarde.';

/** True when the request never reached a KAYA API: network failure, timeout, or a static host answering with HTML. */
export function isServerUnreachable(error: unknown): boolean {
  const err = record(error);
  if (!err) return false;
  const response = record(err.response);
  if (!response) return err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK';
  const status = response.status;
  const data = response.data;
  const html = typeof data === 'string' && /<html|<!doctype/i.test(data);
  return html || status === 405 || status === 502 || status === 503 || status === 504;
}

/** Convert FastAPI string or validation-detail responses into safe UI text. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isServerUnreachable(error)) return SERVER_UNREACHABLE_MESSAGE;
  const detail = record(record(record(error)?.response)?.data)?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => record(item)?.msg)
      .filter((message): message is string => typeof message === 'string')
      .filter((message): message is string => Boolean(message));
    if (messages.length) return messages.join(' ');
  }
  const message = record(detail)?.message;
  if (typeof message === 'string') {
    return message;
  }
  return fallback;
}
