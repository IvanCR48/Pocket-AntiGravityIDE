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

  it('exposes acceptFile and rejectFile methods', () => {
    assert.strictEqual(typeof adapter.acceptFile, 'function');
    assert.strictEqual(typeof adapter.rejectFile, 'function');
  });
});

const { ReviewChangesUseCase } = require('../../src/core/usecases/review-changes.usecase');

describe('ReviewChangesUseCase Isolation', () => {
  it('acceptFile only calls vcs.acceptFile and never calls ideAutomation.acceptFocusedHunk', async () => {
    let vcsAcceptFileCalledWith = null;
    let ideAcceptHunkCalled = false;

    const mockVcs = {
      acceptFile: async (root, file) => {
        vcsAcceptFileCalledWith = { root, file };
        return { success: true };
      }
    };
    const mockIde = {
      acceptFocusedHunk: async () => {
        ideAcceptHunkCalled = true;
      }
    };

    const useCase = new ReviewChangesUseCase({
      vcsPort: mockVcs,
      ideAutomationPort: mockIde
    });

    const res = await useCase.acceptFile('/fake/root', 'src/app.js');
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(vcsAcceptFileCalledWith, { root: '/fake/root', file: 'src/app.js' });
    assert.strictEqual(ideAcceptHunkCalled, false, 'acceptFile must NEVER trigger ideAutomation.acceptFocusedHunk');
  });

  it('acceptAll calls both ideAutomation.acceptFocusedHunk and vcs.acceptAll', async () => {
    let vcsAcceptAllCalled = false;
    let ideAcceptHunkCalled = false;

    const mockVcs = {
      acceptAll: async () => {
        vcsAcceptAllCalled = true;
        return { success: true };
      }
    };
    const mockIde = {
      acceptFocusedHunk: async () => {
        ideAcceptHunkCalled = true;
      }
    };

    const useCase = new ReviewChangesUseCase({
      vcsPort: mockVcs,
      ideAutomationPort: mockIde
    });

    const res = await useCase.acceptAll('/fake/root');
    assert.strictEqual(res.success, true);
    assert.strictEqual(ideAcceptHunkCalled, true);
    assert.strictEqual(vcsAcceptAllCalled, true);
  });
});

