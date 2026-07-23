/**
 * Video teleconsult room.
 *
 * Pilot-grade: opens a Jitsi Meet room named after the consultation so the
 * patient and doctor land in the same call, with no account or credentials
 * required. For production, swap this for a HIPAA/GDPR-compliant provider
 * (Twilio Video, Vonage, Daily, or a self-hosted Jitsi) — configurable via
 * VITE_VIDEO_BASE.
 */
const VIDEO_BASE = (import.meta as any).env?.VITE_VIDEO_BASE || 'https://meet.jit.si';

export function videoRoomUrl(consultationId: string): string {
  return `${VIDEO_BASE.replace(/\/$/, '')}/KAYA-${consultationId}`;
}

export function openVideoRoom(consultationId: string): void {
  window.open(videoRoomUrl(consultationId), '_blank', 'noopener,noreferrer');
}
