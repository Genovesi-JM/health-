import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationInboxPath, loadNotificationPage, loadUnreadNotificationCount, mergeNotificationPages,
  markNotificationRead, applyNotificationRead, markAllNotificationsRead, notificationConsultationTarget,
  notificationChannelsMessage, notificationDate, notificationEmptyMessage, notificationError, canRetainNotificationsAfterError,
} from '../src/screens/notifications.ts';

const consultationId = '76632698-e722-4a09-a73f-0bcc6eb4c5bf';
const notice = {
  id: 'dcb2515b-ecc3-4c1a-a050-11b493b8f41b', title: 'Consulta aceite', message: 'O médico confirmou o horário.',
  type: 'info', is_read: false, created_at: '2026-10-04T09:00:00+00:00', read_at: null, channel: 'in_app',
  related_entity_type: 'consultation', related_entity_id: consultationId,
};
const other = { ...notice, id: '64b573a0-9fe5-4ea7-9c97-e5a3a6c656ac', related_entity_type: null, related_entity_id: null };
const readNotice = { ...notice, is_read: true, read_at: '2026-10-04T09:15:00+00:00' };
const capabilities = { channels: { in_app: true, email: false, sms: false, push: false }, read_is_care_acknowledgement: false };

test('inbox queries use an explicit filter and escape opaque pagination cursors', () => {
  assert.equal(notificationInboxPath(false), '/api/v1/notifications/inbox?limit=20&unread_only=false');
  const url = new URL(notificationInboxPath(true, 'opaque/+?cursor=x&limit=500'), 'https://example.invalid');
  assert.equal(url.searchParams.get('cursor'), 'opaque/+?cursor=x&limit=500');
  assert.equal(url.searchParams.get('limit'), '20');
  assert.equal(url.searchParams.get('unread_only'), 'true');
});

test('inbox preserves string IDs, server cursor and global unread count rather than counting the page', async () => {
  const expected = { items: [notice], next_cursor: 'opaque-next-page', unread_count: 57 };
  const paths = [];
  const actual = await loadNotificationPage({ async get(path) { paths.push(path); return { data: expected }; } }, false);
  assert.deepEqual(actual, expected);
  assert.equal(actual.unread_count, 57);
  assert.deepEqual(paths, ['/api/v1/notifications/inbox?limit=20&unread_only=false']);
});

test('failed reads reject without substituting an empty inbox or a zero badge', async () => {
  for (const failure of [new Error('offline'), { response: { status: 503 } }, { response: { status: 403 } }]) {
    const api = { async get() { throw failure; } };
    await assert.rejects(() => loadNotificationPage(api, false), error => error === failure);
    await assert.rejects(() => loadUnreadNotificationCount(api), error => error === failure);
  }
});

test('malformed page counts or items cannot become a successful empty-state result', async () => {
  const valid = { items: [notice], next_cursor: null, unread_count: 1 };
  for (const data of [null, {}, { ...valid, unread_count: -1 }, { ...valid, unread_count: '1' },
    { ...valid, unread_count: 1.5 }, { ...valid, items: null }, { ...valid, next_cursor: 2 },
    { ...valid, items: [{ ...notice, id: 12 }] }, { ...valid, items: [{ ...notice, is_read: 'false' }] }]) {
    await assert.rejects(() => loadNotificationPage({ async get() { return { data }; } }, false), /verificar/);
  }
  assert.deepEqual(await loadNotificationPage({ async get() { return { data: { items: [], next_cursor: null, unread_count: 0 } }; } }, true),
    { items: [], next_cursor: null, unread_count: 0 });
});

test('pagination deduplicates overlap and updates existing notices without losing loaded rows', () => {
  const original = [notice, other];
  const next = { ...other, id: 'older-notice' };
  const merged = mergeNotificationPages(original, [readNotice, next]);
  assert.deepEqual(merged.map(item => item.id), [notice.id, other.id, next.id]);
  assert.equal(merged[0].is_read, true);
  assert.equal(original[0].is_read, false);
});

test('mark-one waits for the matching server acknowledgement and uses the exact encoded ID', async () => {
  const paths = [];
  let finish;
  const result = markNotificationRead({ patch: path => {
    paths.push(path);
    return new Promise(resolve => { finish = resolve; });
  } }, notice.id);
  assert.equal(notice.is_read, false);
  finish({ data: readNotice });
  assert.deepEqual(await result, readNotice);
  assert.deepEqual(paths, [`/api/v1/notifications/${notice.id}/read`]);
  const specialId = 'notification/one?private=1';
  await markNotificationRead({ async patch(path) {
    assert.equal(path, '/api/v1/notifications/notification%2Fone%3Fprivate%3D1/read');
    return { data: { ...readNotice, id: specialId } };
  } }, specialId);
});

test('mismatched, unread, or failed mutation responses never confirm reading', async () => {
  for (const data of [{ ...readNotice, id: 'another' }, notice, null]) {
    await assert.rejects(() => markNotificationRead({ async patch() { return { data }; } }, notice.id), /confirmar a leitura/);
  }
  const failure = { response: { status: 503 } };
  await assert.rejects(() => markNotificationRead({ async patch() { throw failure; } }, notice.id), error => error === failure);
  assert.equal(notice.is_read, false);
});

test('successful read reconciles all and unread caches without fabricating other read states', () => {
  const original = [notice, other];
  const all = applyNotificationRead(original, readNotice, false);
  const unread = applyNotificationRead(original, readNotice, true);
  assert.deepEqual(all, [readNotice, other]);
  assert.deepEqual(unread, [other]);
  assert.deepEqual(original, [notice, other]);
  assert.deepEqual(applyNotificationRead([other], readNotice, false), [other]);
});

test('reading the last loaded unread row does not hide unread notifications on later pages', () => {
  const items = applyNotificationRead([notice], readNotice, true);
  assert.deepEqual(items, []);
  assert.match(notificationEmptyMessage(true, 11, 'next-page'), /Carregue mais/);
  assert.match(notificationEmptyMessage(true, 11, null), /Atualize a lista/);
  assert.match(notificationEmptyMessage(true, 0, 'next-page'), /Carregue mais/);
});

test('empty inbox copy requires a verified zero and no further page before claiming no unread notices', () => {
  assert.equal(notificationEmptyMessage(true, 0, null), 'Não tem notificações por ler.');
  assert.equal(notificationEmptyMessage(false, 0, null), 'Ainda não tem notificações.');
  for (const unreadOnly of [true, false]) {
    assert.match(notificationEmptyMessage(unreadOnly, null, null), /Atualize a lista/);
    assert.match(notificationEmptyMessage(unreadOnly, 0, null, true), /Atualize a lista/);
    assert.match(notificationEmptyMessage(unreadOnly, 11, null), /Atualize a lista/);
    assert.match(notificationEmptyMessage(unreadOnly, 0, 'next-page', true), /Carregue mais/);
  }
});

test('read-all accepts its committed count including zero but does not treat it as global unread', async () => {
  for (const updated_count of [0, 27]) {
    const result = await markAllNotificationsRead({ async patch(path) {
      assert.equal(path, '/api/v1/notifications/read-all');
      return { data: { ok: true, updated_count } };
    } });
    assert.equal(result, updated_count);
  }
});

test('read-all incomplete acknowledgements and errors remain failures', async () => {
  for (const data of [{ ok: true }, { ok: false, updated_count: 3 }, { ok: true, updated_count: -1 },
    { ok: true, updated_count: '3' }, { ok: true, updated_count: 2.3 }, null]) {
    await assert.rejects(() => markAllNotificationsRead({ async patch() { return { data }; } }), /confirmar a leitura/);
  }
  const failure = new Error('lost acknowledgement');
  await assert.rejects(() => markAllNotificationsRead({ async patch() { throw failure; } }), error => error === failure);
});

test('home badge reads the exact global unread endpoint', async () => {
  const paths = [];
  const count = await loadUnreadNotificationCount({ async get(path) { paths.push(path); return { data: { unread: 132 } }; } });
  assert.equal(count, 132);
  assert.deepEqual(paths, ['/api/v1/notifications/unread-count']);
  for (const data of [{ unread_count: 5 }, [], null, { unread: -1 }, { unread: 0.5 }, { unread: '8' }]) {
    await assert.rejects(() => loadUnreadNotificationCount({ async get() { return { data }; } }), /contagem/);
  }
});

test('only valid consultation references navigate to the fixed patient detail route', () => {
  assert.deepEqual(notificationConsultationTarget(notice), { consultationId });
  for (const item of [{ ...notice, related_entity_type: 'url' }, { ...notice, related_entity_type: 'patient' },
    { ...notice, related_entity_type: 'prescription' }, { ...notice, related_entity_id: 'https://evil.invalid/steal' },
    { ...notice, related_entity_id: '../../other-patient' }, { ...notice, related_entity_id: null },
    { ...notice, related_entity_id: 'javascript:alert(1)' }]) assert.equal(notificationConsultationTarget(item), null);
});

test('external channel limitations and unknown capabilities remain explicit', () => {
  const message = notificationChannelsMessage(capabilities);
  assert.match(message, /nesta aplicação/);
  assert.match(message, /Email, SMS e notificações push ainda não estão ativos/);
  assert.match(notificationChannelsMessage(null), /Não foi possível verificar/);
  assert.match(notificationChannelsMessage({}), /Não foi possível verificar/);
  assert.match(notificationChannelsMessage({ ...capabilities, channels: { ...capabilities.channels, in_app: false } }), /não está disponível/);
  assert.match(notificationChannelsMessage({ ...capabilities, channels: { ...capabilities.channels, push: true } }), /não é confirmada aqui/);
});

test('display dates preserve UTC instants and handle invalid metadata', () => {
  assert.equal(notificationDate('2026-10-04T10:00:00+01:00'), notificationDate('2026-10-04T09:00:00Z'));
  assert.equal(notificationDate('invalid'), 'Data indisponível');
});

test('errors use readable API details without leaking raw transport messages or validation objects', () => {
  assert.equal(notificationError({ response: { data: { detail: 'Notificação indisponível.' } } }, 'Tente novamente.'), 'Notificação indisponível.');
  for (const error of [null, new Error('Raw URL/token'), { response: { data: { detail: [{ msg: 'raw' }] } } }]) {
    assert.equal(notificationError(error, 'Tente novamente.'), 'Tente novamente.');
  }
});

test('authorization loss clears cached notices while transient failures permit a labelled stale view', () => {
  for (const status of [401, 403]) assert.equal(canRetainNotificationsAfterError({ response: { status } }), false);
  for (const error of [new Error('offline'), { response: { status: 500 } }, { response: { status: 503 } }]) {
    assert.equal(canRetainNotificationsAfterError(error), true);
  }
});
