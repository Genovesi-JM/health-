function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** Read an HTTP status without assuming every thrown value is an Axios error. */
export function apiErrorStatus(error: unknown): number | undefined {
  const status = record(record(error)?.response)?.status;
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
}

/** Convert FastAPI string or validation-detail responses into safe UI text. */
export function apiErrorMessage(error: unknown, fallback: string): string {
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
