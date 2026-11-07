import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const xcodeRequire = createRequire(require.resolve('xcode/package.json'));

test('xcode scoped UUID dependency retains native project roundtrip and valid unique IDs', () => {
  const folder = mkdtempSync(join(tmpdir(), 'kaya-xcode-uuid-'));
  try {
    const filename = join(folder, 'project.pbxproj');
    writeFileSync(filename, `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 46;
  objects = {
    /* Begin PBXProject section */
    AAAAAAAAAAAAAAAAAAAAAAAA /* Project object */ = {
      isa = PBXProject;
      targets = (BBBBBBBBBBBBBBBBBBBBBBBB /* KAYA */,);
    };
    /* End PBXProject section */
    /* Begin PBXNativeTarget section */
    BBBBBBBBBBBBBBBBBBBBBBBB /* KAYA */ = {
      isa = PBXNativeTarget;
      name = KAYA;
    };
    /* End PBXNativeTarget section */
  };
  rootObject = AAAAAAAAAAAAAAAAAAAAAAAA /* Project object */;
}
`);
    const project = xcode.project(filename);
    project.parseSync();
    const ids = new Set();
    for (let index = 0; index < 1_000; index++) {
      const id = project.generateUuid();
      assert.match(id, /^[0-9A-F]{24}$/);
      assert.equal(ids.has(id), false);
      ids.add(id);
    }
    writeFileSync(filename, project.writeSync());
    const reparsed = xcode.project(filename);
    reparsed.parseSync();
    assert.equal(reparsed.getFirstTarget().firstTarget.name, 'KAYA');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('the UUID copy resolved by xcode rejects undersized caller buffers', () => {
  const uuid = xcodeRequire('uuid');
  assert.throws(() => uuid.v3('kaya', uuid.v3.DNS, new Uint8Array(15)), RangeError);
  assert.throws(() => uuid.v5('kaya', uuid.v5.DNS, new Uint8Array(15)), RangeError);
});
