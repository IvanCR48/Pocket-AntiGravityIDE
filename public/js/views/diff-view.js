import { authFetch } from '../auth.js';

let currentChanges = null;
let selectedDiffFileIndex = 0;

const changesBanner = document.getElementById('changes-banner');
const changesSummaryText = document.getElementById('changes-summary-text');
const btnReviewDiffs = document.getElementById('btn-review-diffs');
const btnRejectChanges = document.getElementById('btn-reject-changes');
const btnAcceptChanges = document.getElementById('btn-accept-changes');

const diffModal = document.getElementById('diff-modal');
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

export async function handleAcceptChanges() {
  if (!confirm('Accept all pending changes in Antigravity IDE?')) return;

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
    } else {
      alert(`Error accepting changes: ${data.error}`);
    }
  } catch (err) {
    alert(`Failed to accept changes: ${err.message}`);
  } finally {
    if (modalAcceptBtn) {
      modalAcceptBtn.textContent = 'Accept All';
      modalAcceptBtn.disabled = false;
    }
  }
}

export async function handleRejectChanges() {
  if (!confirm('Discard and restore all changed files to their previous state?')) return;

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
    } else {
      alert(`Error rejecting changes: ${data.error}`);
    }
  } catch (err) {
    alert(`Failed to reject changes: ${err.message}`);
  } finally {
    if (modalRejectBtn) {
      modalRejectBtn.textContent = 'Reject All';
      modalRejectBtn.disabled = false;
    }
  }
}

export function initDiffView() {
  if (btnReviewDiffs) btnReviewDiffs.addEventListener('click', openDiffModal);
  if (btnRejectChanges) btnRejectChanges.addEventListener('click', handleRejectChanges);
  if (btnAcceptChanges) btnAcceptChanges.addEventListener('click', handleAcceptChanges);

  if (closeDiffModalBtn) closeDiffModalBtn.addEventListener('click', () => {
    if (diffModal) diffModal.style.display = 'none';
  });
  if (modalRejectBtn) modalRejectBtn.addEventListener('click', handleRejectChanges);
  if (modalAcceptBtn) modalAcceptBtn.addEventListener('click', handleAcceptChanges);
}
