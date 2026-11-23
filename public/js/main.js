/* ── Modal ── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); el.querySelector('.modal')?.focus(); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  if (e.target.dataset.modal) openModal(e.target.dataset.modal);
  if (e.target.dataset.closeModal) closeModal(e.target.dataset.closeModal);
  if (e.target.closest('[data-modal]')) openModal(e.target.closest('[data-modal]').dataset.modal);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

/* ── Tabs ── */
document.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tabSet = btn.closest('.tab-set');
  if (!tabSet) return;
  tabSet.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const target = btn.dataset.tab;
  tabSet.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === target);
  });
});

/* ── Color swatches ── */
document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    sw.closest('.color-swatches').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    const inp = document.getElementById(sw.dataset.target);
    if (inp) inp.value = sw.dataset.color;
  });
});

/* ── Collapsible result rows ── */
document.addEventListener('click', e => {
  const hdr = e.target.closest('.run-result-header');
  if (!hdr) return;
  const body = hdr.nextElementSibling;
  if (body?.classList.contains('run-result-body')) {
    body.classList.toggle('open');
    const arrow = hdr.querySelector('.result-arrow');
    if (arrow) arrow.textContent = body.classList.contains('open') ? '▲' : '▼';
  }
});

/* ── Status update (AJAX) ── */
document.addEventListener('change', async e => {
  const sel = e.target.closest('.result-status-select');
  if (!sel) return;
  const url = sel.dataset.url;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: sel.value })
    });
    if (r.ok) {
      showToast('Status updated', 'success');
      const badge = sel.closest('.run-result-header')?.querySelector('.result-status-badge');
      if (badge) {
        badge.textContent = sel.value.replace('_', ' ');
        badge.className = 'status-badge result-status-badge ' + sel.value;
      }
      // update progress counts
      updateProgress();
    }
  } catch { }
});

function updateProgress() {
  const selects = document.querySelectorAll('.result-status-select');
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
  let total = selects.length;
  selects.forEach(s => { if (counts[s.value] !== undefined) counts[s.value]++; });

  const bar = document.querySelector('.progress-stacked');
  if (bar && total > 0) {
    ['passed', 'failed', 'blocked', 'skipped', 'pending'].forEach(st => {
      const seg = bar.querySelector(`.seg-${st}`);
      if (seg) seg.style.width = ((counts[st] / total) * 100) + '%';
    });
  }
  Object.keys(counts).forEach(st => {
    const el = document.querySelector(`.count-${st}`);
    if (el) el.textContent = counts[st];
  });
}

/* ── Toast ── */
let toastContainer;
function showToast(msg, type = '') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 2500);
}

/* ── Rich Text Editor ── */
function initRichEditor(wrap) {
  const toolbar = wrap.querySelector('.rich-editor-toolbar');
  const editor = wrap.querySelector('.rich-editor');
  const hidden = wrap.querySelector('input[type=hidden]');

  if (!toolbar || !editor) return;

  toolbar.addEventListener('mousedown', e => {
    e.preventDefault();
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val;
    if (cmd === 'insertImage') {
      triggerImageUpload(editor);
    } else if (cmd === 'insertVideo') {
      triggerVideoUpload(editor, () => syncHidden(editor, hidden));
    } else if (cmd === 'createLink') {
      const url = prompt('URL:');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, val || null);
    }
    editor.focus();
    syncHidden(editor, hidden);
    updateToolbarState(toolbar, editor);
  });

  editor.addEventListener('input', () => { syncHidden(editor, hidden); });
  editor.addEventListener('keyup', () => updateToolbarState(toolbar, editor));
  editor.addEventListener('mouseup', () => updateToolbarState(toolbar, editor));

  // Paste images
  editor.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        uploadImage(file).then(url => {
          if (url) {
            editor.focus();
            document.execCommand('insertImage', false, url);
            syncHidden(editor, hidden);
          }
        });
        return;
      }
    }
  });

  // Drag-drop images
  editor.addEventListener('drop', async e => {
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        uploadImage(file).then(url => {
          if (url) {
            editor.focus();
            document.execCommand('insertImage', false, url);
          }
        });
      } else if (file.type.startsWith('video/')) {
        e.preventDefault();
        uploadVideo(file).then(url => {
          if (url) {
            editor.focus();
            insertVideo(editor, url);
            syncHidden(editor, hidden);
          }
        });
      }
    }
  });
}

function syncHidden(editor, hidden) {
  if (hidden) hidden.value = editor.innerHTML;
}

function updateToolbarState(toolbar, editor) {
  toolbar.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (['bold', 'italic', 'underline', 'strikeThrough'].includes(cmd)) {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    }
  });
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  try {
    const r = await fetch('/upload/image', { method: 'POST', body: fd });
    const data = await r.json();
    return data.url;
  } catch { return null; }
}

function triggerImageUpload(editor) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const url = await uploadImage(inp.files[0]);
    if (url) {
      editor.focus();
      document.execCommand('insertImage', false, url);
    }
  };
  inp.click();
}

async function uploadVideo(file) {
  const fd = new FormData();
  fd.append('video', file);
  try {
    const r = await fetch('/upload/video', { method: 'POST', body: fd });
    const data = await r.json();
    return data.url;
  } catch { return null; }
}

function triggerVideoUpload(editor, syncFn) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'video/*';
  inp.onchange = async () => {
    const url = await uploadVideo(inp.files[0]);
    if (url) {
      editor.focus();
      insertVideo(editor, url);
      if (syncFn) syncFn();
    }
  };
  inp.click();
}

function insertVideo(editor, url) {
  const video = document.createElement('video');
  video.src = url;
  video.controls = true;
  video.style.maxWidth = '100%';
  video.style.borderRadius = '4px';
  video.style.margin = '4px 0';
  // Insert at cursor position
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(video);
    range.setStartAfter(video);
    range.setEndAfter(video);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(video);
  }
}

document.querySelectorAll('.rich-editor-wrap').forEach(initRichEditor);

/* ── Note management ── */
document.addEventListener('submit', async e => {
  const form = e.target.closest('.add-note-form');
  if (!form) return;
  e.preventDefault();
  const content = form.querySelector('input[name=content]')?.value || '';
  if (!content.trim()) return;
  const url = form.dataset.url;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await r.json();
    if (data.ok) {
      const notesList = form.closest('.run-result-body').querySelector('.notes-list');
      const div = document.createElement('div');
      div.className = 'note-card';
      div.innerHTML = `<div class="note-card-header"><span class="note-time">Just now</span></div><div class="note-content">${data.note.content}</div>`;
      notesList.appendChild(div);
      // reset editor
      const editor = form.querySelector('.rich-editor');
      const hidden = form.querySelector('input[name=content]');
      if (editor) { editor.innerHTML = ''; }
      if (hidden) hidden.value = '';
      showToast('Note added', 'success');
    }
  } catch { }
});

/* ── Select all test cases ── */
document.addEventListener('change', e => {
  const master = e.target.closest('#select-all-cases');
  if (!master) return;
  document.querySelectorAll('.case-checkbox').forEach(c => c.checked = master.checked);
});

/* ── Case filter/search ── */
const caseSearch = document.getElementById('case-search');
if (caseSearch) {
  caseSearch.addEventListener('input', () => {
    const q = caseSearch.value.toLowerCase();
    document.querySelectorAll('.tc-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

/* ── Test plan source toggle (plan vs manual) ── */
const runSourceSelect = document.getElementById('run-source');
if (runSourceSelect) {
  function toggleRunSource() {
    const v = runSourceSelect.value;
    document.getElementById('run-plan-section')?.classList.toggle('hidden', v !== 'plan');
    document.getElementById('run-manual-section')?.classList.toggle('hidden', v !== 'manual');
  }
  runSourceSelect.addEventListener('change', toggleRunSource);
  toggleRunSource();
}

/* ── Confirm delete (delegated) ── */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-confirm]');
  if (!btn) return;
  if (!confirm(btn.dataset.confirm || 'Are you sure?')) {
    e.preventDefault();
    e.stopPropagation();
  }
});

/* small helpers */
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

/* ── Accordion ── */
document.addEventListener('click', e => {
  const trigger = e.target.closest('.accordion-trigger');
  if (!trigger) return;
  const group = trigger.closest('.accordion-group');
  const body = group.querySelector('.accordion-body');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  trigger.setAttribute('aria-expanded', String(!isOpen));
});

/* ── Issue multi-select toggle ── */
const issueSelectTrigger = document.getElementById('issue-multiselect-trigger');
const issueSelectDropdown = document.getElementById('issue-multiselect-dropdown');

if (issueSelectTrigger && issueSelectDropdown) {
  issueSelectTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = issueSelectDropdown.style.display !== 'none';
    issueSelectDropdown.style.display = isOpen ? 'none' : 'block';
  });

  document.addEventListener('click', function() {
    if (issueSelectDropdown) issueSelectDropdown.style.display = 'none';
  });

  // Update trigger label to show selected count
  document.querySelectorAll('.issue-checkbox').forEach(function(cb) {
    cb.addEventListener('change', function() {
      const checked = document.querySelectorAll('.issue-checkbox:checked').length;
      const label = document.getElementById('issue-select-label');
      if (label) {
        label.textContent = checked === 0 ? 'Select issues to link…' : checked + ' issue' + (checked !== 1 ? 's' : '') + ' linked';
        label.style.color = checked === 0 ? 'var(--text-3)' : 'var(--text)';
      }
    });
  });
}

/* ── Code language select sync ── */
document.querySelectorAll('.code-lang-select').forEach(function(sel) {
  sel.addEventListener('change', function() {
    const targetId = this.dataset.target;
    const hidden = document.getElementById(targetId);
    if (hidden) hidden.value = this.value;
  });
});


/* ── Repo case group filter + inline add ── */
(function () {
  const filterBar = document.getElementById('case-group-filters');
  const tbody = document.getElementById('repo-cases-tbody');
  const searchInput = document.getElementById('case-filter-search');
  const emptyState = document.getElementById('case-filter-empty');
  if (!filterBar || !tbody) return;

  let activeGroup = 'all';

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.case-row'));
  }

  function renumber() {
    let n = 1;
    getRows().forEach(row => {
      if (row.style.display === 'none') return;
      const cell = row.querySelector('.case-sno');
      if (cell) cell.textContent = n++;
    });
  }

  function updateCounts() {
    const rows = getRows();
    const total = rows.length;
    const ungrouped = rows.filter(r => r.dataset.groupId === 'ungrouped').length;
    const badge = document.getElementById('case-count-badge');
    if (badge) badge.textContent = total;
    const tabBadge = document.getElementById('tab-cases-count');
    if (tabBadge) tabBadge.textContent = total;
    const allBtn = filterBar.querySelector('[data-group-filter="all"] .count');
    if (allBtn) allBtn.textContent = total;
    const unBtn = document.getElementById('count-ungrouped');
    if (unBtn) unBtn.textContent = ungrouped;
    filterBar.querySelectorAll('[data-group-count]').forEach(el => {
      const gid = el.getAttribute('data-group-count');
      el.textContent = rows.filter(r => r.dataset.groupId === String(gid)).length;
    });
  }

  function applyFilter() {
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    let visible = 0;
    getRows().forEach(row => {
      const groupId = row.dataset.groupId || 'ungrouped';
      const title = (row.dataset.title || '').toLowerCase();
      const tags = (row.dataset.tags || '').toLowerCase();
      const matchGroup = activeGroup === 'all' || String(groupId) === String(activeGroup);
      const matchSearch = !q || title.includes(q) || tags.includes(q);
      const show = matchGroup && matchSearch;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    renumber();
    if (emptyState) emptyState.style.display = (visible === 0 && getRows().length > 0) ? '' : 'none';
  }

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('[data-group-filter]');
    if (!btn) return;
    filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    activeGroup = btn.getAttribute('data-group-filter');
    // sync inline add group select
    const groupSelect = document.getElementById('inline-case-group');
    if (groupSelect) {
      if (activeGroup !== 'all' && activeGroup !== 'ungrouped') groupSelect.value = activeGroup;
      else if (activeGroup === 'ungrouped') groupSelect.value = '';
    }
    applyFilter();
  });

  if (searchInput) searchInput.addEventListener('input', applyFilter);

  // Inline add
  const saveBtn = document.getElementById('inline-case-save');
  const titleInput = document.getElementById('inline-case-title');
  const addRow = document.getElementById('inline-add-row');
  if (saveBtn && titleInput && addRow) {
    const project = addRow.dataset.project;
    const repo = addRow.dataset.repo;
    const endpoint = `/projects/${project}/repos/${repo}/cases`;

    async function saveInline() {
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); titleInput.style.borderColor = 'var(--red)'; return; }
      titleInput.style.borderColor = '';
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
      const payload = {
        title,
        priority: document.getElementById('inline-case-priority').value,
        type: document.getElementById('inline-case-type').value,
        status: document.getElementById('inline-case-status').value,
        group_id: document.getElementById('inline-case-group').value || '',
      };
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
        const tc = data.case;
        const tr = document.createElement('tr');
        tr.className = 'case-row';
        tr.dataset.caseId = tc.id;
        tr.dataset.groupId = tc.group_id ? String(tc.group_id) : 'ungrouped';
        tr.dataset.title = tc.title || '';
        tr.dataset.tags = tc.tags || '';
        const caseUrl = `/projects/${project}/repos/${repo}/cases/${tc.id}`;
        const editUrl = caseUrl + '/edit';
        const delUrl = caseUrl + '/delete';
        const pri = tc.priority || 'medium';
        const type = tc.type || 'functional';
        const status = tc.status || 'active';
        const groupName = tc.group_name || '—';
        const tags = tc.tags ? `<span class="case-tags text-muted" title="${escapeHtml(tc.tags)}">${escapeHtml(tc.tags)}</span>` : '<span class="text-muted">—</span>';
        tr.innerHTML = `
          <td class="col-order case-sno"></td>
          <td class="col-case"><a class="case-link" href="${caseUrl}" title="${escapeHtml(tc.title)}">${escapeHtml(tc.title)}</a></td>
          <td><span class="priority-badge ${pri}"><span class="priority-dot ${pri}"></span>${cap(pri)}</span></td>
          <td><span class="badge badge-gray">${typeLabel(type)}</span></td>
          <td><span class="status-badge ${status}">${cap(status)}</span></td>
          <td class="col-group"><span class="text-muted">${escapeHtml(groupName)}</span></td>
          <td class="col-tags">${tags}</td>
          <td class="col-actions"><div class="btn-group">
            <a href="${editUrl}" class="btn btn-ghost btn-sm">Edit</a>
            <form action="${delUrl}" method="POST" style="display:inline"><button type="submit" class="btn btn-ghost btn-sm text-danger" data-confirm="Delete this test case?">Del</button></form>
          </div></td>`;
        tbody.insertBefore(tr, addRow);
        titleInput.value = '';
        updateCounts();
        applyFilter();
        titleInput.focus();
      } catch (err) {
        alert(err.message || 'Could not add test case');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add';
      }
    }

    function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    function typeLabel(t) { return ({functional:'Functional',regression:'Regression',smoke:'Smoke',performance:'Performance',security:'Security',usability:'Usability',other:'Other'})[t] || t; }

    saveBtn.addEventListener('click', saveInline);
    titleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveInline(); }
    });
    titleInput.addEventListener('input', () => { titleInput.style.borderColor = ''; });
  }

  updateCounts();
  applyFilter();
})();
