const { describe, it } = require('node:test');
const assert = require('node:assert');
const { GitAdapter } = require('../../src/infrastructure/vcs/git.adapter');

describe('GitAdapter Diff Parsing', () => {
  const adapter = new GitAdapter();

  it('returns empty array for empty diff string', () => {
    const diffs = adapter.parseUnifiedDiff('');
    assert.deepStrictEqual(diffs, []);
  });

  it('parses unified diff additions and deletions', () => {
    const sampleDiff = `diff --git a/src/server.js b/src/server.js
index 1234567..abcdef0 100644
--- a/src/server.js
+++ b/src/server.js
@@ -1,5 +1,6 @@
 const express = require('express');
+const http = require('http');
-const old = true;
+const old = false;
`;

    const diffs = adapter.parseUnifiedDiff(sampleDiff);
    assert.strictEqual(diffs.length, 1);
    assert.strictEqual(diffs[0].file, 'src/server.js');
    assert.strictEqual(diffs[0].additions, 2);
    assert.strictEqual(diffs[0].deletions, 1);
    assert.strictEqual(diffs[0].status, 'modified');
  });
});
