// =====================================================================
// base.js — lógica da tela de Base de Clientes
// =====================================================================

let allRecords = [];
let editingIndex = null;     // null = adicionando, number = id
let pendingConfirmAction = null;
let searchTimeout = null;

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadBase();
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      onSearch();
    }
  });
});

// ── Carregar base ─────────────────────────────────
async function loadBase(query = '') {
  try {
    const url = query ? `/cp/clientes?q=${encodeURIComponent(query)}` : '/cp/clientes';
    const data = await window.api.get(url);
    allRecords = data.results;
    document.getElementById('counter').textContent =
      query ? `${data.filtered} de ${data.total} registros` : `${data.total} registros`;
    renderTable();
  } catch (err) {
    document.getElementById('counter').textContent = 'Erro ao carregar: ' + err.message;
  }
}

// ── Busca com debounce ────────────────────────────
function onSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadBase(document.getElementById('searchInput').value);
  }, 300);
}

// ── Renderizar tabela ─────────────────────────────
function renderTable() {
  const tbody = document.getElementById('tableBody');

  if (allRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhum registro encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = allRecords.map((r) => {
    const modeloClass = (r.modelo || '').includes('FIXO') ? 'modelo-fixo' : 'modelo-cp';
    const modeloLabel = (r.modelo || '').includes('FIXO') ? 'FIXO' : 'CONTRA PEDIDO';
    return `
    <tr>
      <td><strong>${esc(r.sigla)}</strong></td>
      <td>${esc(r.codigo)}</td>
      <td>${esc(r.cliente)}</td>
      <td>${esc(r.endereco)}</td>
      <td>${esc(r.complem)}</td>
      <td>${esc(r.bairro)}</td>
      <td>${esc(r.cep)}</td>
      <td>${esc(r.cidade)}</td>
      <td>${esc(r.uf)}</td>
      <td><span class="${modeloClass}">${modeloLabel}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openEditModal(${r.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="confirmRemove(${r.id}, '${esc(r.sigla)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Escape HTML ───────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Modal: Adicionar ──────────────────────────────
function openAddModal() {
  editingIndex = null;
  document.getElementById('modalTitle').textContent = '➕ Novo Cliente';
  clearModalFields();
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('mSigla').focus();
}

// ── Modal: Editar ─────────────────────────────────
function openEditModal(id) {
  const record = allRecords.find((r) => r.id === id);
  if (!record) return;

  editingIndex = id;
  document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';

  document.getElementById('mSigla').value = record.sigla;
  document.getElementById('mCodigo').value = record.codigo;
  document.getElementById('mCliente').value = record.cliente;
  document.getElementById('mEndereco').value = record.endereco;
  document.getElementById('mComplem').value = record.complem;
  document.getElementById('mBairro').value = record.bairro;
  document.getElementById('mCep').value = record.cep;
  document.getElementById('mCidade').value = record.cidade;
  document.getElementById('mUf').value = record.uf;
  document.getElementById('mModelo').value = record.modelo || 'CONTRA PEDIDO';

  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('mSigla').focus();
}

// ── Modal: Salvar ─────────────────────────────────
async function saveModal() {
  const body = {
    sigla: document.getElementById('mSigla').value.trim().toUpperCase(),
    codigo: document.getElementById('mCodigo').value.trim(),
    cliente: document.getElementById('mCliente').value.trim().toUpperCase(),
    endereco: document.getElementById('mEndereco').value.trim().toUpperCase(),
    complem: document.getElementById('mComplem').value.trim(),
    bairro: document.getElementById('mBairro').value.trim().toUpperCase(),
    cep: document.getElementById('mCep').value.trim(),
    cidade: document.getElementById('mCidade').value.trim().toUpperCase(),
    uf: document.getElementById('mUf').value.trim().toUpperCase(),
    modelo: document.getElementById('mModelo').value,
  };

  if (!body.sigla || !body.codigo) {
    showToast('Sigla e código são obrigatórios.', 'error');
    return;
  }

  try {
    let result;
    if (editingIndex !== null) {
      result = await window.api.put(`/cp/clientes/${editingIndex}`, body);
    } else {
      result = await window.api.post('/cp/clientes', body);
    }
    if (result.success) {
      showToast(result.message, 'success');
      closeModal();
      loadBase(document.getElementById('searchInput').value);
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Modal: Fechar ─────────────────────────────────
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  editingIndex = null;
}

function clearModalFields() {
  ['mSigla','mCodigo','mCliente','mEndereco','mComplem','mBairro','mCep','mCidade','mUf'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  document.getElementById('mModelo').value = 'CONTRA PEDIDO';
}

// ── Confirmar remoção ─────────────────────────────
function confirmRemove(id, sigla) {
  document.getElementById('confirmText').textContent =
    `Tem certeza que deseja remover "${sigla}" da base?`;
  pendingConfirmAction = () => removeRecord(id);
  document.getElementById('confirmOverlay').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('show');
  pendingConfirmAction = null;
}

function confirmAction() {
  if (pendingConfirmAction) pendingConfirmAction();
  closeConfirm();
}

async function removeRecord(id) {
  try {
    const result = await window.api.delete(`/cp/clientes/${id}`);
    if (result.success) {
      showToast(result.message, 'success');
      loadBase(document.getElementById('searchInput').value);
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Máscara CEP ───────────────────────────────────
function onCepInput(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  el.value = v.slice(0, 9);
}

// ── Fechar modais com ESC ou clique fora ──────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeConfirm();
  }
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
  if (e.target.id === 'confirmOverlay') closeConfirm();
});

// ── Toast ─────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}
