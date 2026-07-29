/** Convert FastAPI string or validation-detail responses into safe UI text. */
export function apiErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => typeof item?.msg === 'string' ? item.msg : null)
      .filter((message): message is string => Boolean(message));
    if (messages.length) return messages.join(' ');
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }
  return fallback;
}
