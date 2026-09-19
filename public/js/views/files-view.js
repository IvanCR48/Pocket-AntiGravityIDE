import { authFetch } from '../auth.js';
import { parseMarkdown } from './chat-view.js';

let currentViewingFilePath = null;

const fileTreeEl = document.getElementById('file-tree');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const fileModal = document.getElementById('file-viewer-modal');
const modalFileTitle = document.getElementById('modal-file-title');
const modalFileBody = document.getElementById('modal-file-body');
const closeModalBtn = document.getElementById('close-modal-btn');
const attachFilePromptBtn = document.getElementById('attach-file-prompt-btn');
const promptInput = document.getElementById('prompt-input');
const tabChatBtn = document.getElementById('tab-chat-btn');

export async function loadWorkspaceTree() {
  if (!fileTreeEl) return;
  fileTreeEl.innerHTML = '<div class="loading-state">Loading workspace files...</div>';
  try {
    const res = await authFetch('/api/workspace/tree');
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.tree) {
        fileTreeEl.innerHTML = '';
        renderTreeNodes(data.tree, fileTreeEl);
      } else {
        fileTreeEl.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Server response: ${data.error || text}</div>`;
      }
    } catch (_) {
      fileTreeEl.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Please restart node src/server.js to load file tree.</div>`;
    }
  } catch (err) {
    fileTreeEl.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Error loading files: ${err.message}</div>`;
  }
}

export function renderTreeNodes(nodes, container) {
  nodes.forEach((node) => {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';

    if (node.type === 'directory') {
      const dirHeader = document.createElement('div');
      dirHeader.className = 'tree-item directory';
      dirHeader.innerHTML = `📁 <span>${node.name}</span>`;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children collapsed';

      dirHeader.addEventListener('click', () => {
        const isCollapsed = childrenContainer.classList.contains('collapsed');
        if (isCollapsed) {
          childrenContainer.classList.remove('collapsed');
          dirHeader.innerHTML = `📂 <span>${node.name}</span>`;
        } else {
          childrenContainer.classList.add('collapsed');
          dirHeader.innerHTML = `📁 <span>${node.name}</span>`;
        }
      });

      nodeEl.appendChild(dirHeader);
      nodeEl.appendChild(childrenContainer);

      if (node.children && node.children.length > 0) {
        renderTreeNodes(node.children, childrenContainer);
      }
    } else {
      const fileItem = document.createElement('div');
      fileItem.className = 'tree-item file';
      fileItem.innerHTML = `📄 <span>${node.name}</span>`;

      fileItem.addEventListener('click', () => openFileModal(node.relativePath));
      nodeEl.appendChild(fileItem);
    }

    container.appendChild(nodeEl);
  });
}

export async function openFileModal(relPath) {
  if (!fileModal) return;
  currentViewingFilePath = relPath;
  if (modalFileTitle) modalFileTitle.textContent = relPath;
  if (modalFileBody) modalFileBody.innerHTML = '<div class="loading-state">Loading file content...</div>';
  
  const planApproveBtn = document.getElementById('plan-approve-modal-btn');
  if (planApproveBtn) planApproveBtn.style.display = 'none';

  fileModal.style.display = 'flex';

  try {
    const res = await authFetch(`/api/workspace/file?path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    if (data.success) {
      if (data.language === 'markdown') {
        if (modalFileBody) modalFileBody.innerHTML = parseMarkdown(data.content);
      } else {
        const parsed = parseMarkdown(`\`\`\`${data.language || 'plaintext'}\n${data.content}\n\`\`\``);
        if (modalFileBody) modalFileBody.innerHTML = parsed;
      }
    } else {
      if (modalFileBody) modalFileBody.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Error: ${data.error}</div>`;
    }
  } catch (err) {
    if (modalFileBody) modalFileBody.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Failed to load file: ${err.message}</div>`;
  }
}

export async function openArtifactModal(rawPath) {
  if (!fileModal) return;
  currentViewingFilePath = rawPath;

  const fileName = rawPath.split(/[\/\\]/).pop() || 'Artifact';
  if (modalFileTitle) modalFileTitle.textContent = `📋 ${fileName}`;
  if (modalFileBody) modalFileBody.innerHTML = '<div class="loading-state">Loading artifact & plan content...</div>';

  const planApproveBtn = document.getElementById('plan-approve-modal-btn');
  if (planApproveBtn) planApproveBtn.style.display = 'none';

  fileModal.style.display = 'flex';

  try {
    const res = await authFetch(`/api/sessions/active/artifact?path=${encodeURIComponent(rawPath)}`);
    const data = await res.json();
    if (data.success) {
      if (modalFileTitle) modalFileTitle.textContent = `📋 ${data.fileName}`;
      if (modalFileBody) {
        if (data.language === 'markdown') {
          modalFileBody.innerHTML = parseMarkdown(data.content);
        } else {
          modalFileBody.innerHTML = parseMarkdown(`\`\`\`${data.language || 'plaintext'}\n${data.content}\n\`\`\``);
        }
      }
      if (data.isPlan && planApproveBtn) {
        planApproveBtn.style.display = 'inline-flex';
      }
    } else {
      if (modalFileBody) modalFileBody.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Error: ${data.error}</div>`;
    }
  } catch (err) {
    if (modalFileBody) modalFileBody.innerHTML = `<div class="loading-state" style="color:var(--accent-error)">Failed to load artifact: ${err.message}</div>`;
  }
}

// Expose globally for markdown onclick callbacks
window.openPocketArtifact = openArtifactModal;

export function initFilesView() {
  if (refreshFilesBtn) {
    refreshFilesBtn.addEventListener('click', loadWorkspaceTree);
  }

  if (closeModalBtn && fileModal) {
    closeModalBtn.addEventListener('click', () => {
      fileModal.style.display = 'none';
    });
  }

  const planApproveBtn = document.getElementById('plan-approve-modal-btn');
  if (planApproveBtn) {
    planApproveBtn.addEventListener('click', async () => {
      if (typeof window.approvePocketPlan === 'function') {
        await window.approvePocketPlan();
      }
      if (fileModal) fileModal.style.display = 'none';
    });
  }

  if (attachFilePromptBtn) {
    attachFilePromptBtn.addEventListener('click', () => {
      if (currentViewingFilePath && promptInput) {
        promptInput.value = `${promptInput.value} @${currentViewingFilePath} `.trimStart();
        if (fileModal) fileModal.style.display = 'none';
        if (tabChatBtn) tabChatBtn.click();
        promptInput.focus();
      }
    });
  }
}
