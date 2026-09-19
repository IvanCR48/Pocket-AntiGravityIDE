import { authFetch } from '../auth.js';

let currentChanges = null;
let selectedDiffFileIndex = 0;

const changesBanner = document.getElementById('changes-banner');
const changesSummaryText = document.getElementById('changes-summary-text');
const btnReviewDiffs = document.getElementById('btn-review-diffs');
const btnRejectChanges = document.getElementById('btn-reject-changes');
const btnAcceptChanges = document.getElementById('btn-accept-changes');

const diffModal = document.getElementById('diff-modal');
const diffModalContent = document.querySelector('.diff-modal-content');
const diffStampAccept = document.getElementById('diff-stamp-accept');
const diffStampReject = document.getElementById('diff-stamp-reject');
const closeDiffModalBtn = document.getElementById('close-diff-modal-btn');
const diffModalStats = document.getElementById('diff-modal-stats');
const diffFilesBar = document.getElementById('diff-files-bar');
const diffBodyContainer = document.getElementById('diff-body-container');
const modalRejectBtn = document.getElementById('modal-reject-btn');
const modalAcceptBtn = document.getElementById('modal-accept-btn');

// Card Deck Elements
const diffCardCounter = document.getElementById('diff-card-counter');
const diffActiveFilename = document.getElementById('diff-active-filename');
const diffActiveStats = document.getElementById('diff-active-stats');
const diffStackBackdrop = document.getElementById('diff-stack-backdrop');
const diffStackNextFile = document.getElementById('diff-stack-next-file');
const fabDiffReject = document.getElementById('fab-diff-reject');
const fabDiffAccept = document.getElementById('fab-diff-accept');

// ----------------------------------------------------
// 1. Subtle & Smooth Web Audio Synthesizer
// ----------------------------------------------------
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSubtleAcceptSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc2.frequency.setValueAtTime(880.00, now + 0.04); // A5

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.24);
    osc2.stop(now + 0.24);
  } catch (_) {}
}

export function playSubtleRejectSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (_) {}
}

function triggerHaptic(duration = 15) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(duration);
    } catch (_) {}
  }
}

// ----------------------------------------------------
// 2. Diff View Rendering & Deck State
// ----------------------------------------------------
export function updateChangesBanner(changes) {
  currentChanges = changes;
  if (!changesBanner) return;

  const isModalOpen = diffModal && diffModal.style.display === 'flex';

  if (changes && changes.hasChanges && changes.files && changes.files.length > 0) {
    const count = changes.summary ? changes.summary.files : changes.files.length;
    const add = changes.summary ? changes.summary.additions : changes.files.reduce((acc, f) => acc + f.additions, 0);
    const del = changes.summary ? changes.summary.deletions : changes.files.reduce((acc, f) => acc + f.deletions, 0);
    if (changesSummaryText) {
      changesSummaryText.textContent = `${count} file${count > 1 ? 's' : ''} modified (+${add} / -${del})`;
    }
    changesBanner.style.display = 'flex';

    if (isModalOpen) {
      if (selectedDiffFileIndex >= currentChanges.files.length) {
        selectedDiffFileIndex = Math.max(0, currentChanges.files.length - 1);
      }
      renderDiffFileTabs();
      renderSelectedFileDiff();
    }
  } else {
    changesBanner.style.display = 'none';
    if (isModalOpen) {
      // If modal was open and files reached 0, render the celebration state smoothly
      renderSelectedFileDiff();
    }
  }
}

export async function checkChanges() {
  try {
    const res = await authFetch('/api/changes');
    const data = await res.json();
    updateChangesBanner(data);
  } catch (_) {}
}

export function openDiffModal() {
  if (!currentChanges || !currentChanges.files || currentChanges.files.length === 0) return;

  resetCardTransform();
  selectedDiffFileIndex = 0;

  renderDiffFileTabs();
  renderSelectedFileDiff();
  if (diffModal) diffModal.style.display = 'flex';

  // Play introductory peek nudge
  if (diffModalContent) {
    diffModalContent.classList.add('teaser-nudge');
    setTimeout(() => {
      if (diffModalContent) diffModalContent.classList.remove('teaser-nudge');
    }, 700);
  }
}

export function renderDiffFileTabs() {
  if (!diffFilesBar) return;
  diffFilesBar.innerHTML = '';

  if (!currentChanges || !currentChanges.files || currentChanges.files.length === 0) {
    diffFilesBar.style.display = 'none';
    return;
  }
  diffFilesBar.style.display = 'flex';

  currentChanges.files.forEach((f, idx) => {
    const chip = document.createElement('div');
    chip.className = `diff-file-chip ${idx === selectedDiffFileIndex ? 'active' : ''}`;
    chip.innerHTML = `
      <span>📄 ${f.file}</span>
      <span class="diff-file-chip-add">+${f.additions}</span>
      <span class="diff-file-chip-del">-${f.deletions}</span>
    `;
    chip.addEventListener('click', () => {
      selectedDiffFileIndex = idx;
      renderDiffFileTabs();
      renderSelectedFileDiff();
    });
    diffFilesBar.appendChild(chip);
  });
}

export function renderSelectedFileDiff() {
  if (!diffBodyContainer) return;

  if (!currentChanges || !currentChanges.files || currentChanges.files.length === 0) {
    // Celebratory all-reviewed state
    diffBodyContainer.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; margin: auto;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
        <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-bright); margin-bottom: 6px;">All Changes Reviewed!</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">Workspace is clean and up to date.</div>
        <button id="diff-all-reviewed-close-btn" class="btn-diff-action success" style="max-width: 140px; margin: 0 auto; display: block;">Close</button>
      </div>
    `;
    const finishBtn = document.getElementById('diff-all-reviewed-close-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        if (diffModal) diffModal.style.display = 'none';
      });
    }

    if (diffCardCounter) diffCardCounter.textContent = '0 of 0';
    if (diffActiveFilename) diffActiveFilename.textContent = 'All Clean';
    if (diffActiveStats) diffActiveStats.textContent = '';
    if (diffStackBackdrop) diffStackBackdrop.style.display = 'none';
    return;
  }

  const fileData = currentChanges.files[selectedDiffFileIndex];
  if (!fileData) return;

  // Update card counter & headers
  if (diffCardCounter) {
    diffCardCounter.textContent = `Card ${selectedDiffFileIndex + 1} of ${currentChanges.files.length}`;
  }
  if (diffActiveFilename) {
    diffActiveFilename.textContent = fileData.file;
  }
  if (diffActiveStats) {
    diffActiveStats.textContent = `+${fileData.additions} / -${fileData.deletions}`;
  }

  // Update Stack Backdrop
  if (selectedDiffFileIndex + 1 < currentChanges.files.length) {
    const nextFile = currentChanges.files[selectedDiffFileIndex + 1];
    if (diffStackBackdrop && diffStackNextFile) {
      diffStackNextFile.textContent = `Next: ${nextFile.file} (+${nextFile.additions}/-${nextFile.deletions})`;
      diffStackBackdrop.style.display = 'flex';
    }
  } else {
    if (diffStackBackdrop) diffStackBackdrop.style.display = 'none';
  }

  // Render Diff Lines (with safe 1,000-line mobile performance cap)
  diffBodyContainer.innerHTML = '';
  const lines = (fileData.diff || '').split('\n');
  const MAX_LINES = 1000;
  const isLarge = lines.length > MAX_LINES;
  const linesToRender = (fileData._showAllLines || !isLarge) ? lines : lines.slice(0, MAX_LINES);

  linesToRender.forEach((line) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'diff-line';

    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineEl.classList.add('added');
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lineEl.classList.add('deleted');
    } else if (line.startsWith('@@')) {
      lineEl.classList.add('hunk-header');
    }

    lineEl.textContent = line || ' ';
    diffBodyContainer.appendChild(lineEl);
  });

  if (isLarge && !fileData._showAllLines) {
    const limitNotice = document.createElement('div');
    limitNotice.className = 'diff-line-limit-banner';
    limitNotice.innerHTML = `
      <span>⚡ Showing first ${MAX_LINES} lines of ${lines.length} for smooth mobile performance.</span>
      <button class="btn-load-all-lines">Load All ${lines.length} Lines</button>
    `;
    const loadBtn = limitNotice.querySelector('.btn-load-all-lines');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        fileData._showAllLines = true;
        renderSelectedFileDiff();
      });
    }
    diffBodyContainer.appendChild(limitNotice);
  }
}

export function resetCardTransform() {
  if (diffModalContent) {
    diffModalContent.classList.remove('swipe-fly-right', 'swipe-fly-left', 'swipe-reset');
    diffModalContent.style.transform = '';
    diffModalContent.style.boxShadow = '';
  }
  if (diffStampAccept) {
    diffStampAccept.style.opacity = '0';
    diffStampAccept.style.transform = 'rotate(-14deg) scale(0.8)';
  }
  if (diffStampReject) {
    diffStampReject.style.opacity = '0';
    diffStampReject.style.transform = 'rotate(14deg) scale(0.8)';
  }
  if (fabDiffAccept) fabDiffAccept.classList.remove('active-scale');
  if (fabDiffReject) fabDiffReject.classList.remove('active-scale');
}

// ----------------------------------------------------
// 3. Granular Per-File & Batch Actions
// ----------------------------------------------------
export async function executeAcceptCurrentFile() {
  if (!currentChanges || !currentChanges.files || !currentChanges.files[selectedDiffFileIndex]) return;
  const currentFile = currentChanges.files[selectedDiffFileIndex];

  playSubtleAcceptSound();
  triggerHaptic(18);

  try {
    const res = await authFetch('/api/changes/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile.file })
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('Accept file warning:', data.error);
    }
  } catch (err) {
    console.warn('Accept file error:', err);
  }

  // Remove reviewed file from active deck
  currentChanges.files.splice(selectedDiffFileIndex, 1);
  if (currentChanges.files.length === 0) {
    currentChanges.hasChanges = false;
    updateChangesBanner(currentChanges);
  }

  if (selectedDiffFileIndex >= currentChanges.files.length) {
    selectedDiffFileIndex = Math.max(0, currentChanges.files.length - 1);
  }

  renderDiffFileTabs();
  renderSelectedFileDiff();
}

export async function executeRejectCurrentFile() {
  if (!currentChanges || !currentChanges.files || !currentChanges.files[selectedDiffFileIndex]) return;
  const currentFile = currentChanges.files[selectedDiffFileIndex];

  playSubtleRejectSound();
  triggerHaptic(18);

  try {
    const res = await authFetch('/api/changes/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile.file })
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('Reject file warning:', data.error);
    }
  } catch (err) {
    console.warn('Reject file error:', err);
  }

  // Remove reviewed file from active deck
  currentChanges.files.splice(selectedDiffFileIndex, 1);
  if (currentChanges.files.length === 0) {
    currentChanges.hasChanges = false;
    updateChangesBanner(currentChanges);
  }

  if (selectedDiffFileIndex >= currentChanges.files.length) {
    selectedDiffFileIndex = Math.max(0, currentChanges.files.length - 1);
  }

  renderDiffFileTabs();
  renderSelectedFileDiff();
}

export async function executeAcceptAll(skipConfirm = false) {
  if (!skipConfirm && !confirm('Accept all pending changes in Antigravity IDE?')) return false;

  if (modalAcceptBtn) {
    modalAcceptBtn.textContent = 'Accepting...';
    modalAcceptBtn.disabled = true;
  }

  try {
    const res = await authFetch('/api/changes/accept', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (diffModal) diffModal.style.display = 'none';
      if (changesBanner) changesBanner.style.display = 'none';
      currentChanges = null;
      playSubtleAcceptSound();
      return true;
    } else {
      alert(`Error accepting changes: ${data.error}`);
      return false;
    }
  } catch (err) {
    alert(`Failed to accept changes: ${err.message}`);
    return false;
  } finally {
    if (modalAcceptBtn) {
      modalAcceptBtn.textContent = 'Accept All';
      modalAcceptBtn.disabled = false;
    }
  }
}

export async function executeRejectAll(skipConfirm = false) {
  if (!skipConfirm && !confirm('Discard and restore all changed files to their previous state?')) return false;

  if (modalRejectBtn) {
    modalRejectBtn.textContent = 'Rejecting...';
    modalRejectBtn.disabled = true;
  }

  try {
    const res = await authFetch('/api/changes/reject', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (diffModal) diffModal.style.display = 'none';
      if (changesBanner) changesBanner.style.display = 'none';
      currentChanges = null;
      playSubtleRejectSound();
      return true;
    } else {
      alert(`Error rejecting changes: ${data.error}`);
      return false;
    }
  } catch (err) {
    alert(`Failed to reject changes: ${err.message}`);
    return false;
  } finally {
    if (modalRejectBtn) {
      modalRejectBtn.textContent = 'Reject All';
      modalRejectBtn.disabled = false;
    }
  }
}

// ----------------------------------------------------
// 4. Smooth 60/120 FPS rAF Swipe Physics Engine
// ----------------------------------------------------
let isDragging = false;
let isSwipingHorizontal = false;
let startX = 0;
let startY = 0;
let currentDeltaX = 0;
let rafPending = false;
let hasTriggeredThresholdHaptic = false;

function updateCardMotion() {
  rafPending = false;
  if (!diffModalContent) return;

  const dx = currentDeltaX;
  const rotZ = dx * 0.045;
  const rotY = dx * -0.02;

  diffModalContent.style.transform = `perspective(1100px) translate3d(${dx}px, 0, 0) rotateZ(${rotZ}deg) rotateY(${rotY}deg)`;

  if (dx > 20) {
    const factor = Math.min((dx - 20) / 95, 1);
    diffModalContent.style.boxShadow = `0 16px 40px rgba(0, 0, 0, 0.55), 0 0 ${Math.round(factor * 28)}px rgba(16, 185, 129, ${factor * 0.45})`;
    if (diffStampAccept) {
      diffStampAccept.style.opacity = factor;
      diffStampAccept.style.transform = `rotate(-14deg) scale(${0.8 + factor * 0.35})`;
    }
    if (diffStampReject) diffStampReject.style.opacity = '0';
    if (fabDiffAccept) fabDiffAccept.classList.add('active-scale');
    if (fabDiffReject) fabDiffReject.classList.remove('active-scale');

    if (dx > 95 && !hasTriggeredThresholdHaptic) {
      triggerHaptic(12);
      hasTriggeredThresholdHaptic = true;
    }
  } else if (dx < -20) {
    const factor = Math.min((Math.abs(dx) - 20) / 95, 1);
    diffModalContent.style.boxShadow = `0 16px 40px rgba(0, 0, 0, 0.55), 0 0 ${Math.round(factor * 28)}px rgba(239, 68, 68, ${factor * 0.45})`;
    if (diffStampReject) {
      diffStampReject.style.opacity = factor;
      diffStampReject.style.transform = `rotate(14deg) scale(${0.8 + factor * 0.35})`;
    }
    if (diffStampAccept) diffStampAccept.style.opacity = '0';
    if (fabDiffReject) fabDiffReject.classList.add('active-scale');
    if (fabDiffAccept) fabDiffAccept.classList.remove('active-scale');

    if (dx < -95 && !hasTriggeredThresholdHaptic) {
      triggerHaptic(12);
      hasTriggeredThresholdHaptic = true;
    }
  } else {
    diffModalContent.style.boxShadow = '';
    if (diffStampAccept) diffStampAccept.style.opacity = '0';
    if (diffStampReject) diffStampReject.style.opacity = '0';
    if (fabDiffAccept) fabDiffAccept.classList.remove('active-scale');
    if (fabDiffReject) fabDiffReject.classList.remove('active-scale');
    hasTriggeredThresholdHaptic = false;
  }
}

export function initSwipeGestures() {
  if (!diffModalContent) return;

  function onStart(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('.diff-file-chip')) return;

    isDragging = true;
    isSwipingHorizontal = false;
    currentDeltaX = 0;
    hasTriggeredThresholdHaptic = false;

    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;

    diffModalContent.classList.remove('swipe-fly-right', 'swipe-fly-left', 'swipe-reset');
  }

  function onMove(e) {
    if (!isDragging) return;

    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;

    if (!isSwipingHorizontal) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isSwipingHorizontal = true;
      } else if (Math.abs(dy) > 10) {
        isDragging = false;
        return;
      }
    }

    if (isSwipingHorizontal) {
      if (e.cancelable) e.preventDefault();
      currentDeltaX = dx;

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(updateCardMotion);
      }
    }
  }

  function onEnd() {
    if (!isDragging || !isSwipingHorizontal) {
      isDragging = false;
      isSwipingHorizontal = false;
      return;
    }

    isDragging = false;
    isSwipingHorizontal = false;

    const threshold = Math.min(105, diffModalContent.offsetWidth * 0.26);

    if (currentDeltaX > threshold) {
      // Swiped Right -> Accept current file card
      diffModalContent.classList.add('swipe-fly-right');
      if (diffStampAccept) {
        diffStampAccept.style.opacity = '1';
        diffStampAccept.style.transform = 'rotate(-14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeAcceptCurrentFile();
        resetCardTransform();
      }, 280);
    } else if (currentDeltaX < -threshold) {
      // Swiped Left -> Reject current file card
      diffModalContent.classList.add('swipe-fly-left');
      if (diffStampReject) {
        diffStampReject.style.opacity = '1';
        diffStampReject.style.transform = 'rotate(14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeRejectCurrentFile();
        resetCardTransform();
      }, 280);
    } else {
      // Below threshold -> Elastic Snap-Back
      diffModalContent.classList.add('swipe-reset');
      if (diffStampAccept) diffStampAccept.style.opacity = '0';
      if (diffStampReject) diffStampReject.style.opacity = '0';
      setTimeout(() => {
        resetCardTransform();
      }, 300);
    }
  }

  diffModalContent.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);

  diffModalContent.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  // Wire Floating Circular Action Buttons
  if (fabDiffAccept) {
    fabDiffAccept.addEventListener('click', async () => {
      diffModalContent.classList.add('swipe-fly-right');
      if (diffStampAccept) {
        diffStampAccept.style.opacity = '1';
        diffStampAccept.style.transform = 'rotate(-14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeAcceptCurrentFile();
        resetCardTransform();
      }, 280);
    });
  }

  if (fabDiffReject) {
    fabDiffReject.addEventListener('click', async () => {
      diffModalContent.classList.add('swipe-fly-left');
      if (diffStampReject) {
        diffStampReject.style.opacity = '1';
        diffStampReject.style.transform = 'rotate(14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeRejectCurrentFile();
        resetCardTransform();
      }, 280);
    });
  }
}

export function initDiffView() {
  if (btnReviewDiffs) btnReviewDiffs.addEventListener('click', openDiffModal);
  if (btnRejectChanges) btnRejectChanges.addEventListener('click', () => executeRejectAll(false));
  if (btnAcceptChanges) btnAcceptChanges.addEventListener('click', () => executeAcceptAll(false));

  if (closeDiffModalBtn) closeDiffModalBtn.addEventListener('click', () => {
    if (diffModal) diffModal.style.display = 'none';
    resetCardTransform();
  });
  if (modalRejectBtn) modalRejectBtn.addEventListener('click', () => executeRejectAll(false));
  if (modalAcceptBtn) modalAcceptBtn.addEventListener('click', () => executeAcceptAll(false));

  initSwipeGestures();
}

