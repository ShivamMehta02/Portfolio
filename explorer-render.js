// ============================================================
// explorer-render.js — All DOM rendering functions
// ============================================================

function renderPipelineNodes(activeId) {
  const container = document.getElementById('pipelineNodes');
  container.innerHTML = '';
  PIPELINE.forEach((node, i) => {
    const el = document.createElement('div');
    el.className = 'p-node' + (activeId === node.id ? ' active' : '');
    el.dataset.id = node.id;
    el.innerHTML = `
      <span class="pn-icon">${node.icon}</span>
      <div class="pn-body">
        <div class="pn-name">${node.name}</div>
        <div class="pn-sub">${node.sub}</div>
      </div>
      <span class="pn-num">${String(i+1).padStart(2,'0')}</span>
    `;
    el.addEventListener('click', () => AppState.select(node.id));
    container.appendChild(el);
    if (i < PIPELINE.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'p-connector';
      container.appendChild(conn);
    }
  });
}

function renderTreeHeader(node) {
  return `
    <div class="th-icon">${node.icon}</div>
    <div class="th-title">${node.name}</div>
    <div class="th-sub">${node.desc}</div>
    <div class="th-meta">${node.tags.map(t => `<span class="th-tag">${t}</span>`).join('')}</div>
  `;
}

function renderSubItems(subs) {
  if (!subs || !subs.length) return '';
  return `<div class="ti-subitems">${subs.map(s => `
    <div class="ti-subitem">
      <span class="si-icon">${s.icon}</span>
      <div class="si-body"><strong>${s.title}</strong>${s.body}</div>
    </div>`).join('')}</div>`;
}

function renderItems(items, type) {
  return items.map((item, idx) => `
    <div class="tree-item ${type}" data-item-id="${type}-${idx}">
      <div class="ti-header" onclick="toggleItem(this)">
        <div class="ti-bullet"></div>
        <div class="ti-title">${item.title}</div>
        <span class="ti-chevron">›</span>
      </div>
      <div class="ti-detail">
        <p>${item.detail}</p>
        ${renderSubItems(item.subs)}
      </div>
    </div>`).join('');
}

function renderCategories(categories) {
  return categories.map((cat, i) => `
    <div class="tree-category" data-cat-id="cat-${i}">
      <div class="tc-header" onclick="toggleCategory(this)">
        <span class="type-badge ${cat.type}">${cat.type}</span>
        <span class="tc-title">${cat.label}</span>
        <span class="tc-count">${cat.items.length} items</span>
        <span class="tc-chevron">›</span>
      </div>
      <div class="tc-children">
        ${renderItems(cat.items, cat.type)}
      </div>
    </div>`).join('');
}

function renderControls() {
  return `
    <div class="tree-controls">
      <button class="ctrl-btn" onclick="expandAll()">Expand All</button>
      <button class="ctrl-btn" onclick="collapseAll()">Collapse All</button>
    </div>`;
}

function renderTree(node) {
  document.getElementById('treeHeader').innerHTML = renderTreeHeader(node);
  document.getElementById('treeRoot').innerHTML =
    renderControls() + renderCategories(node.categories);
}

function showEmpty() {
  document.getElementById('treeEmpty').style.display = 'flex';
  document.getElementById('treeContent').style.display = 'none';
}

function showTree(node) {
  document.getElementById('treeEmpty').style.display = 'none';
  const tc = document.getElementById('treeContent');
  tc.style.display = 'block';
  tc.style.animation = 'none';
  tc.offsetHeight; // reflow
  tc.style.animation = '';
  renderTree(node);
  // Auto-open first category
  const firstCat = document.querySelector('.tc-header');
  if (firstCat) toggleCategory(firstCat);
}
