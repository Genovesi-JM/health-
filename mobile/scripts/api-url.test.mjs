import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveApiBaseUrl } from '../src/config/apiUrl.ts';

const require = createRequire(import.meta.url);

test('distribution requires an explicit endpoint', () => {
  for (const value of [undefined, '', '   ']) {
    assert.throws(() => resolveApiBaseUrl(value, undefined, false), /Configure/);
  }
});

test('uses the canonical endpoint, trims it, and supports the legacy alias', () => {
  assert.equal(resolveApiBaseUrl(' https://api.kaya.test/ ', 'https://old.kaya.test', false), 'https://api.kaya.test');
  assert.equal(resolveApiBaseUrl(' ', 'https://old.kaya.test/gateway/', false), 'https://old.kaya.test/gateway');
});

test('distribution rejects HTTP, loopback aliases and emulator addresses', () => {
  for (const value of [
    'http://api.kaya.test', 'https://localhost', 'https://localhost.',
    'https://api.localhost', 'https://mac.local', 'https://127.0.0.2',
    'https://127.1', 'https://2130706433', 'https://[::1]',
    'https://[::]', 'https://[::ffff:127.0.0.1]', 'https://[::ffff:127.255.255.254]',
    'https://[::ffff:7f00:1]', 'https://[::ffff:0.0.0.0]', 'https://[::127.0.0.1]',
    'https://0.0.0.0', 'https://10.0.2.2', 'https://10.0.3.2',
  ]) assert.throws(() => resolveApiBaseUrl(value, undefined, false), /HTTPS API endpoint/);
});

test('all builds reject malformed URLs, credentials and embedded query data', () => {
  for (const development of [false, true]) {
    for (const value of ['not-a-url', '/api', 'ftp://api.kaya.test', 'https://user:secret@api.kaya.test', 'https://api.kaya.test?token=secret', 'https://api.kaya.test#secret']) {
      assert.throws(() => resolveApiBaseUrl(value, undefined, development));
    }
  }
});

test('development can use simulator, LAN or localhost endpoints', () => {
  assert.equal(resolveApiBaseUrl(undefined, undefined, true), 'http://localhost:8000');
  assert.equal(resolveApiBaseUrl('http://10.0.2.2:8000/', undefined, true), 'http://10.0.2.2:8000');
  assert.equal(resolveApiBaseUrl('http://192.168.1.4:8000', undefined, true), 'http://192.168.1.4:8000');
});

test('works with the URL implementation installed by the pinned Expo SDK', () => {
  const nativeURL = globalThis.URL;
  const { URL: ExpoURL } = require('whatwg-url-minimum');
  try {
    globalThis.URL = ExpoURL;
    assert.equal(resolveApiBaseUrl('https://api.kaya.test/', undefined, false), 'https://api.kaya.test');
    assert.throws(() => resolveApiBaseUrl('https://127.1', undefined, false));
    assert.throws(() => resolveApiBaseUrl('https://[::1]', undefined, false));
    for (const host of ['[::]', '[::ffff:127.0.0.1]', '[::ffff:127.255.255.254]', '[::ffff:7f00:1]', '[::ffff:0.0.0.0]', '[::127.0.0.1]']) {
      assert.throws(() => resolveApiBaseUrl(`https://${host}`, undefined, false));
    }
    assert.throws(() => resolveApiBaseUrl('https://user:secret@api.kaya.test', undefined, false));
    assert.throws(() => resolveApiBaseUrl('https://api.kaya.test?token=secret', undefined, false));
  } finally {
    globalThis.URL = nativeURL;
  }
});
