import { assertOperationalAccess } from '../phase1/policy';

/**
 * Video teleconsult room (Phase 25 — secure provider boundary).
 *
 * There is NO public fallback: no meet.jit.si default, no client-derived room.
 * The room a participant enters is decided by the SERVER — the backend
 * `/api/v1/teleconsultations/{id}/join` endpoint fails closed (503) unless an
 * approved, DPA-covered provider is enabled server-side, and only then returns a
 * full `room_url` built from an unguessable, server-issued room key. The client
 * never constructs a room from a Kaya id.
 *
 * A production provider stays BLOCKED_EXTERNAL until the video release gate
 * (DPA, data region/transfer, security, accessibility, retention, clinical
 * fallback) is approved.
 */
const VIDEO_BASE = ((import.meta as any).env?.VITE_VIDEO_BASE || '').replace(/\/$/, '');

export function videoEnabled(): boolean {
  return VIDEO_BASE.length > 0;
}

/** A server room key must carry real entropy and must not be a bare Kaya id. */
export function isServerRoomKey(key: string): boolean {
  const body = key.startsWith('KAYA-') ? key.slice(5) : key;
  return body.length >= 24 && !/\s/.test(body);
}

/**
 * Open a room URL that the SERVER produced (from its join response). We only
 * open it when it sits under the configured, approved provider base — never an
 * arbitrary or client-chosen destination.
 */
export function openServerVideoRoom(roomUrl: string): void {
  assertOperationalAccess();
  if (!videoEnabled()) {
    throw new Error('Video is disabled: no approved provider configured.');
  }
  if (!roomUrl || !roomUrl.startsWith(VIDEO_BASE + '/')) {
    throw new Error('Refusing to open a room outside the approved provider base.');
  }
  window.open(roomUrl, '_blank', 'noopener,noreferrer');
}

/** Build a room URL from a server-issued key (guarded; no public fallback). */
export function videoRoomUrl(serverRoomKey: string): string {
  if (!videoEnabled()) {
    throw new Error('Video is disabled: no approved provider configured.');
  }
  if (!isServerRoomKey(serverRoomKey)) {
    throw new Error('Refusing to build a room from a non-server-issued key.');
  }
  return `${VIDEO_BASE}/${serverRoomKey}`;
}

/**
 * Legacy entry point retained for the operational-hold contract test. It fails
 * closed on every axis: the operational hold throws first while the app is held,
 * video is disabled without an approved base, and a guessable (Kaya-id) key is
 * rejected before any window opens.
 */
export function openVideoRoom(serverRoomKey: string): void {
  assertOperationalAccess();
  window.open(videoRoomUrl(serverRoomKey), '_blank', 'noopener,noreferrer');
}
