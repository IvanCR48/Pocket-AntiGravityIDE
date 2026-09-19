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

export function updateChangesBanner(changes) {
  currentChanges = changes;
  if (!changesBanner) return;

  if (changes && changes.hasChanges && changes.files && changes.files.length > 0) {
    const count = changes.summary.files;
    const add = changes.summary.additions;
    const del = changes.summary.deletions;
    if (changesSummaryText) {
      changesSummaryText.textContent = `${count} file${count > 1 ? 's' : ''} modified (+${add} / -${del})`;
    }
    changesBanner.style.display = 'flex';
  } else {
    changesBanner.style.display = 'none';
    if (diffModal) diffModal.style.display = 'none';
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
  if (diffModalStats) {
    diffModalStats.textContent = `(${currentChanges.summary.files} files • +${currentChanges.summary.additions} / -${currentChanges.summary.deletions})`;
  }

  renderDiffFileTabs();
  renderSelectedFileDiff();
  if (diffModal) diffModal.style.display = 'flex';
}

export function renderDiffFileTabs() {
  if (!diffFilesBar) return;
  diffFilesBar.innerHTML = '';

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
  const fileData = currentChanges.files[selectedDiffFileIndex];
  if (!fileData) return;

  diffBodyContainer.innerHTML = '';
  const lines = (fileData.diff || '').split('\n');

  lines.forEach((line) => {
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
}

export function resetCardTransform() {
  if (diffModalContent) {
    diffModalContent.classList.remove('swipe-fly-right', 'swipe-fly-left', 'swipe-reset');
    diffModalContent.style.transform = '';
  }
  if (diffStampAccept) {
    diffStampAccept.style.opacity = '0';
    diffStampAccept.style.transform = 'rotate(-14deg) scale(0.8)';
  }
  if (diffStampReject) {
    diffStampReject.style.opacity = '0';
    diffStampReject.style.transform = 'rotate(14deg) scale(0.8)';
  }
}

export async function executeAcceptChanges(skipConfirm = false) {
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

export async function executeRejectChanges(skipConfirm = false) {
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

export function handleAcceptChanges() {
  return executeAcceptChanges(false);
}

export function handleRejectChanges() {
  return executeRejectChanges(false);
}

let isDragging = false;
let isSwipingHorizontal = false;
let startX = 0;
let startY = 0;
let currentDeltaX = 0;

export function initSwipeGestures() {
  if (!diffModalContent) return;

  function onStart(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('.diff-file-chip')) return;

    isDragging = true;
    isSwipingHorizontal = false;
    currentDeltaX = 0;

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
        // Vertical scroll in diff code, cancel swipe gesture
        isDragging = false;
        return;
      }
    }

    if (isSwipingHorizontal) {
      if (e.cancelable) e.preventDefault();
      currentDeltaX = dx;
      const rot = dx * 0.045;
      diffModalContent.style.transform = `translate3d(${dx}px, 0, 0) rotate(${rot}deg)`;

      if (dx > 25) {
        const factor = Math.min((dx - 25) / 95, 1);
        if (diffStampAccept) {
          diffStampAccept.style.opacity = factor;
          diffStampAccept.style.transform = `rotate(-14deg) scale(${0.8 + factor * 0.35})`;
        }
        if (diffStampReject) diffStampReject.style.opacity = '0';
      } else if (dx < -25) {
        const factor = Math.min((Math.abs(dx) - 25) / 95, 1);
        if (diffStampReject) {
          diffStampReject.style.opacity = factor;
          diffStampReject.style.transform = `rotate(14deg) scale(${0.8 + factor * 0.35})`;
        }
        if (diffStampAccept) diffStampAccept.style.opacity = '0';
      } else {
        if (diffStampAccept) diffStampAccept.style.opacity = '0';
        if (diffStampReject) diffStampReject.style.opacity = '0';
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
      // Swiped Right -> ACCEPT
      diffModalContent.classList.add('swipe-fly-right');
      if (diffStampAccept) {
        diffStampAccept.style.opacity = '1';
        diffStampAccept.style.transform = 'rotate(-14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeAcceptChanges(true);
        resetCardTransform();
      }, 300);
    } else if (currentDeltaX < -threshold) {
      // Swiped Left -> REJECT
      diffModalContent.classList.add('swipe-fly-left');
      if (diffStampReject) {
        diffStampReject.style.opacity = '1';
        diffStampReject.style.transform = 'rotate(14deg) scale(1.15)';
      }
      setTimeout(async () => {
        await executeRejectChanges(true);
        resetCardTransform();
      }, 300);
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
}

export function initDiffView() {
  if (btnReviewDiffs) btnReviewDiffs.addEventListener('click', openDiffModal);
  if (btnRejectChanges) btnRejectChanges.addEventListener('click', handleRejectChanges);
  if (btnAcceptChanges) btnAcceptChanges.addEventListener('click', handleAcceptChanges);

  if (closeDiffModalBtn) closeDiffModalBtn.addEventListener('click', () => {
    if (diffModal) diffModal.style.display = 'none';
    resetCardTransform();
  });
  if (modalRejectBtn) modalRejectBtn.addEventListener('click', handleRejectChanges);
  if (modalAcceptBtn) modalAcceptBtn.addEventListener('click', handleAcceptChanges);

  initSwipeGestures();
}
