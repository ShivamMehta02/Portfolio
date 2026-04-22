// ============================================================
// explorer-state.js — State management + interactions + init
// ============================================================

// ===== STATE =====
const AppState = {
  selectedId: null,
  select(id) {
    this.selectedId = id;
    const node = PIPELINE.find(n => n.id === id);
    if (!node) return;
    renderPipelineNodes(id);
    showTree(node);
    document.querySelector('.tree-panel').scrollTop = 0;
  },
  deselect() {
    this.selectedId = null;
    renderPipelineNodes(null);
    showEmpty();
  }
};

// ===== TOGGLE CATEGORY (Level 2) =====
function toggleCategory(headerEl) {
  const isOpen = headerEl.classList.contains('open');
  const children = headerEl.nextElementSibling;
  if (isOpen) {
    headerEl.classList.remove('open');
    children.classList.remove('open');
  } else {
    headerEl.classList.add('open');
    children.classList.add('open');
  }
}

// ===== TOGGLE ITEM (Level 3) =====
function toggleItem(headerEl) {
  const isOpen = headerEl.classList.contains('open');
  const detail = headerEl.nextElementSibling;
  if (isOpen) {
    headerEl.classList.remove('open');
    detail.classList.remove('open');
  } else {
    headerEl.classList.add('open');
    detail.classList.add('open');
  }
}

// ===== EXPAND / COLLAPSE ALL =====
function expandAll() {
  document.querySelectorAll('.tc-header').forEach(h => {
    h.classList.add('open');
    h.nextElementSibling.classList.add('open');
  });
  document.querySelectorAll('.ti-header').forEach(h => {
    h.classList.add('open');
    h.nextElementSibling.classList.add('open');
  });
}

function collapseAll() {
  document.querySelectorAll('.tc-header').forEach(h => {
    h.classList.remove('open');
    h.nextElementSibling.classList.remove('open');
  });
  document.querySelectorAll('.ti-header').forEach(h => {
    h.classList.remove('open');
    h.nextElementSibling.classList.remove('open');
  });
}

// ===== KEYBOARD NAVIGATION =====
document.addEventListener('keydown', e => {
  const idx = PIPELINE.findIndex(n => n.id === AppState.selectedId);
  if (e.key === 'ArrowDown' || e.key === 'j') {
    const next = PIPELINE[Math.min(idx + 1, PIPELINE.length - 1)];
    if (next) AppState.select(next.id);
  }
  if (e.key === 'ArrowUp' || e.key === 'k') {
    const prev = PIPELINE[Math.max(idx - 1, 0)];
    if (prev) AppState.select(prev.id);
  }
  if (e.key === 'Escape') AppState.deselect();
  if (e.key === ' ') { e.preventDefault(); expandAll(); }
});

// ===== INIT =====
renderPipelineNodes(null);
showEmpty();
// Auto-select first node after short delay for engagement
setTimeout(() => AppState.select('user-query'), 400);
