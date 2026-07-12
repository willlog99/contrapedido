// =====================================================================
// app.js — lógica da tela principal de Contra Pedido
// Lê de / grava no Worker CP via window.api (ver api.js)
// =====================================================================

// ── Estado ─────────────────────────────────────────
let selectedClient = null;
let currentTab = 'SEGUNDA';
let allData = {};
let filtrosAtivos = false;

// ── Inicialização ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();

  document.getElementById('searchCodigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') buscarCodigo();
  });
});

// ── Buscar código ou sigla ─────────────────────────
async function buscarCodigo() {
  const input = document.getElementById('searchCodigo').value.trim();
  if (!input) return;

  hideElements();

  const isNumeric = /^\d+$/.test(input);
  let results = [];

  if (isNumeric) {
    try {
      const data = await window.api.get(`/cp/clientes/buscar/${encodeURIComponent(input)}`);
      results = data.results || [];
    } catch (_) { results = []; }
  }

  if (results.length === 0) {
    try {
      const data = await window.api.get(`/cp/clientes/sigla/${encodeURIComponent(input)}`);
      results = data.results || [];
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  if (results.length === 0) {
    showToast(`Nenhum resultado para "${input}"`, 'error');
    return;
  }

  if (results.length === 1) {
    selectClient(results[0]);
  } else {
    showDuplicates(results);
  }
}

// ── Exibir duplicatas ──────────────────────────────
function showDuplicates(results) {
  const container = document.getElementById('duplicatesContent');
  container.innerHTML = '';
  results.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'dup-item';
    div.textContent = `${r.sigla} (Cód: ${r.codigo}) — ${r.cliente} — ${r.cidade}`;
    div.onclick = () => selectClient(r);
    container.appendChild(div);
  });
  document.getElementById('duplicatesList').classList.add('show');
}

// ── Selecionar cliente ─────────────────────────────
function selectClient(client) {
  selectedClient = client;
  hideElements();

  document.getElementById('infoSigla').textContent = client.sigla;
  document.getElementById('infoCliente').textContent = client.cliente;
  document.getElementById('infoEndereco').textContent = client.endereco;
  document.getElementById('infoBairro').textContent = client.bairro;
  document.getElementById('infoCep').textContent = client.cep;
  document.getElementById('infoCidade').textContent = `${client.cidade} - ${client.uf || ''}`;

  document.getElementById('clientInfo').classList.add('show');
  document.getElementById('formFields').style.display = 'block';

  document.getElementById('fCodigo').value = client.codigo;
  document.getElementById('fCliente').value = client.sigla;
  document.getElementById('fResponsavel').value = '';
  document.getElementById('fData').value = '';
  document.getElementById('fRota').value = '';
  document.getElementById('fHorario').value = '';
  document.getElementById('diaBadge').textContent = '';

  document.getElementById('fResponsavel').focus();
}

// ── Máscara de data ────────────────────────────────
function onDataInput(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
  el.value = v.slice(0, 10);

  if (v.length === 10) {
    checkDiaSemana(v);
  } else {
    document.getElementById('diaBadge').textContent = '';
  }
}

async function checkDiaSemana(data) {
  try {
    const result = await window.api.get(`/cp/dia-semana/${encodeURIComponent(data)}`);
    const badge = document.getElementById('diaBadge');
    if (result.valid) {
      badge.innerHTML = `<span class="dia-badge">${result.diaSemanaLabel}</span>`;
    } else {
      badge.innerHTML = `<span class="dia-badge" style="background:#e74c3c">Fim de semana / inválida</span>`;
    }
  } catch (_) { /* sem badge se der erro */ }
}

// ── Máscara de horário ─────────────────────────────
function onHorarioInput(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 2) v = v.slice(0, 2) + ':' + v.slice(2);
  el.value = v.slice(0, 5);
}

// ── Salvar registro ────────────────────────────────
async function salvarRegistro() {
  if (!selectedClient) {
    showToast('Busque um código primeiro.', 'error');
    return;
  }

  const data = document.getElementById('fData').value;
  if (!data || data.length < 10) {
    showToast('Preencha a data corretamente (DD/MM/AAAA).', 'error');
    return;
  }

  const body = {
    codigo: document.getElementById('fCodigo').value,
    cliente: document.getElementById('fCliente').value,
    endereco: selectedClient.endereco,
    bairro: selectedClient.bairro,
    cep: selectedClient.cep,
    cidade: selectedClient.cidade,
    uf: selectedClient.uf || '',
    sigla: selectedClient.sigla || '',
    responsavel: document.getElementById('fResponsavel').value,
    data: data,
    rota: document.getElementById('fRota').value,
    horario: document.getElementById('fHorario').value,
  };

  try {
    const result = await window.api.post('/cp/registros', body);
    if (result.success) {
      showToast(result.message, 'success');
      limparForm();
      await loadAllData();
      switchTab(result.diaSemana);
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Limpar formulário ──────────────────────────────
function limparForm() {
  selectedClient = null;
  document.getElementById('searchCodigo').value = '';
  document.getElementById('formFields').style.display = 'none';
  hideElements();
  document.getElementById('searchCodigo').focus();
}

function hideElements() {
  document.getElementById('clientInfo').classList.remove('show');
  document.getElementById('duplicatesList').classList.remove('show');
}

// ── Carregar dados ─────────────────────────────────
async function loadAllData() {
  try {
    allData = await window.api.get('/cp/registros');
    const dias = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
    dias.forEach((dia) => {
      const entries = allData[dia] || [];
      document.getElementById(`badge-${dia}`).textContent = entries.length;
    });
    renderTable(currentTab);
  } catch (err) {
    // primeira vez pode estar vazio
    allData = { SEGUNDA: [], TERCA: [], QUARTA: [], QUINTA: [], SEXTA: [] };
    renderTable(currentTab);
  }
}

// ── Trocar aba ─────────────────────────────────────
function switchTab(dia) {
  if (filtrosAtivos) {
    showToast('Limpe os filtros para mudar de aba', 'error');
    return;
  }
  currentTab = dia;
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.dia === dia);
  });
  renderTable(dia);
}

// ── Renderizar tabela ──────────────────────────────
function renderTable(dia) {
  const tbody = document.getElementById('tableBody');
  let entries = [];

  if (filtrosAtivos) {
    const dias = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
    dias.forEach((d) => {
      const dayEntries = allData[d] || [];
      entries = entries.concat(dayEntries.map((e) => ({ ...e, diaOrigem: d })));
    });
  } else {
    entries = allData[dia] || [];
  }

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="empty-state"><div class="empty-state-icon">📋</div>Nenhum registro encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = entries.map((e) => {
    const status = (e.status || 'pendente').toLowerCase();
    const diaLabel = filtrosAtivos ? `<small style="color: var(--text-muted);">${e.diaOrigem}</small>` : '';
    const diaRef = filtrosAtivos ? e.diaOrigem : currentTab;
    const entryJson = JSON.stringify(e).replace(/"/g, '&quot;');

    return `
    <tr>
      <td><strong>${e.codigo || ''}</strong></td>
      <td>${e.cliente || ''}</td>
      <td>${e.endereco || ''}</td>
      <td>${e.bairro || ''}</td>
      <td>${e.cep || ''}</td>
      <td>${e.cidade || ''}</td>
      <td>${e.responsavel || ''}</td>
      <td>${e.data || ''} ${diaLabel}</td>
      <td>${e.rota || ''}</td>
      <td>${e.horario || ''}</td>
      <td>
        <div class="status-wrapper">
          <span class="status-badge status-${status}" onclick="toggleStatusDropdown(this)">${status}</span>
          <div class="status-dropdown">
            <div class="status-option" onclick="changeStatus('${diaRef}', ${e.rowNumber}, 'pendente', this)">
              <span class="dot dot-pendente"></span> Pendente
            </div>
            <div class="status-option" onclick="changeStatus('${diaRef}', ${e.rowNumber}, 'coletado', this)">
              <span class="dot dot-coletado"></span> Coletado
            </div>
            <div class="status-option" onclick="changeStatus('${diaRef}', ${e.rowNumber}, 'cancelado', this)">
              <span class="dot dot-cancelado"></span> Cancelado
            </div>
          </div>
        </div>
      </td>
      <td style="display: flex; gap: 4px;">
        <button class="btn-icon" title="Editar" onclick="abrirEdicao(${entryJson}, '${diaRef}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" title="Baixar como imagem" onclick="downloadRowImage(${entryJson}, '${diaRef}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Status dropdown ────────────────────────────────
function toggleStatusDropdown(badge) {
  document.querySelectorAll('.status-dropdown.show').forEach((d) => {
    if (d !== badge.nextElementSibling) d.classList.remove('show');
  });
  badge.nextElementSibling.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.status-wrapper')) {
    document.querySelectorAll('.status-dropdown.show').forEach((d) => d.classList.remove('show'));
  }
});

async function changeStatus(dia, rowNumber, newStatus, el) {
  // rowNumber é o número da linha virtual retornado pelo Worker. Como
  // ele muda a cada refetch, a forma robusta de achar o registro é
  // buscar pelo índice. Mas o frontend antigo já usa rowNumber via DOM,
  // então mantemos: pegamos o id real do registro correspondente a essa
  // linha+dia.
  try {
    const entries = allData[dia] || [];
    const entry = entries.find((x) => x.rowNumber === rowNumber);
    if (!entry || !entry.id) {
      showToast('Registro não encontrado, atualize a página.', 'error');
      return;
    }

    const result = await window.api.patch(`/cp/registros/${entry.id}/status`, { status: newStatus });
    if (result.success) {
      showToast(`Status alterado para "${newStatus}"`, 'success');
      await loadAllData();
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Download como imagem ───────────────────────────
async function downloadRowImage(entry, dia) {
  const diasPtBr = {
    SEGUNDA: 'Segunda-feira', TERCA: 'Terça-feira', QUARTA: 'Quarta-feira',
    QUINTA: 'Quinta-feira', SEXTA: 'Sexta-feira',
  };
  const status = (entry.status || 'pendente').toLowerCase();

  const card = document.createElement('div');
  card.className = 'screenshot-card';
  card.innerHTML = `
    <div class="sc-header">
      📋 Contra Pedido — ${diasPtBr[dia] || dia} — ${entry.data || ''}
    </div>
    <div class="sc-body">
      <div class="sc-row"><span class="sc-label">Código</span><span class="sc-value">${entry.codigo || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Cliente</span><span class="sc-value">${entry.cliente || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Endereço</span><span class="sc-value">${entry.endereco || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Bairro</span><span class="sc-value">${entry.bairro || ''}</span></div>
      <div class="sc-row"><span class="sc-label">CEP</span><span class="sc-value">${entry.cep || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Cidade</span><span class="sc-value">${entry.cidade || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Responsável</span><span class="sc-value">${entry.responsavel || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Rota</span><span class="sc-value">${entry.rota || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Horário</span><span class="sc-value">${entry.horario || ''}</span></div>
      <div class="sc-row"><span class="sc-label">Status</span><span class="sc-value"><span class="sc-status sc-status-${status}">${status}</span></span></div>
    </div>
    <div class="sc-footer">LogLife • Contra Pedido 2026 • Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  `;
  document.body.appendChild(card);

  try {
    const canvas = await html2canvas(card, { scale: 2, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `CP_${entry.codigo}_${(entry.data || '').replace(/\//g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Imagem baixada!', 'success');
  } catch (err) {
    showToast('Erro ao gerar imagem: ' + err.message, 'error');
  } finally {
    document.body.removeChild(card);
  }
}

// ── Download Excel ─────────────────────────────────
function downloadExcel() {
  // Usa o endpoint do Worker CP — gera o xlsx lá e devolve binário.
  const a = document.createElement('a');
  a.href = `${window.CP_WORKER_URL}/cp/excel`;
  a.download = 'Contra_Pedido_2026.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Exportar JSON (substitui o "Backup" local) ─────
function exportarJson() {
  const a = document.createElement('a');
  a.href = `${window.CP_WORKER_URL}/cp/export`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Exportação iniciada — confira a pasta de downloads.', 'success');
}

// ── Filtro de data com máscara ──────────────────────
function onFilterDataInput(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
  el.value = v.slice(0, 10);
}

// ── Filtros automáticos (debounce) ─────────────────
let timeoutFiltro = null;
async function aplicarFiltrosAutomatico() {
  clearTimeout(timeoutFiltro);

  timeoutFiltro = setTimeout(async () => {
    const dataInicio = document.getElementById('filterDataInicio').value;
    const dataFim = document.getElementById('filterDataFim').value;
    const rota = document.getElementById('filterRota').value;

    try {
      const params = new URLSearchParams();
      if (dataInicio && dataInicio.length === 10) params.append('dataInicio', dataInicio);
      if (dataFim && dataFim.length === 10) params.append('dataFim', dataFim);
      if (rota) params.append('rota', rota);

      if (!params.toString()) {
        filtrosAtivos = false;
        document.getElementById('filtroAtivoIndicador').style.display = 'none';
        document.getElementById('tabs').style.opacity = '1';
        document.getElementById('tabs').style.pointerEvents = 'auto';
        await loadAllData();
        return;
      }

      allData = await window.api.get(`/cp/registros/filtro?${params.toString()}`);
      filtrosAtivos = true;

      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));

      const dias = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
      dias.forEach((dia) => {
        const entries = allData[dia] || [];
        document.getElementById(`badge-${dia}`).textContent = entries.length;
      });

      document.getElementById('tabs').style.opacity = '0.5';
      document.getElementById('tabs').style.pointerEvents = 'none';
      document.getElementById('filtroAtivoIndicador').style.display = 'block';
      renderTable(null);
    } catch (err) {
      console.error('Erro ao filtrar:', err);
      showToast('Erro ao filtrar: ' + err.message, 'error');
    }
  }, 300);
}

// ── Limpar filtros ─────────────────────────────────
async function limparFiltros() {
  document.getElementById('filterDataInicio').value = '';
  document.getElementById('filterDataFim').value = '';
  document.getElementById('filterRota').value = '';

  filtrosAtivos = false;
  document.getElementById('tabs').style.opacity = '1';
  document.getElementById('tabs').style.pointerEvents = 'auto';
  document.getElementById('filtroAtivoIndicador').style.display = 'none';

  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.dia === currentTab);
  });

  await loadAllData();
  showToast('Filtros removidos!', 'success');
}

// ── Modal de edição ────────────────────────────────
function abrirEdicao(entry, dia) {
  window.edicaoData = { ...entry, dia };

  document.getElementById('editCodigo').value = entry.codigo;
  document.getElementById('editCliente').value = entry.cliente;
  document.getElementById('editEndereco').value = entry.endereco;
  document.getElementById('editBairro').value = entry.bairro;
  document.getElementById('editCep').value = entry.cep;
  document.getElementById('editCidade').value = entry.cidade;
  document.getElementById('editResponsavel').value = entry.responsavel;
  document.getElementById('editData').value = entry.data;
  document.getElementById('editRota').value = entry.rota;
  document.getElementById('editHorario').value = entry.horario;
  document.getElementById('editStatus').value = entry.status || 'pendente';

  document.getElementById('editModal').style.display = 'flex';
}

function fecharEdicao() {
  document.getElementById('editModal').style.display = 'none';
  window.edicaoData = null;
}

async function salvarEdicao() {
  if (!window.edicaoData) return;

  const updates = {
    responsavel: document.getElementById('editResponsavel').value,
    data: document.getElementById('editData').value,
    rota: document.getElementById('editRota').value,
    horario: document.getElementById('editHorario').value,
    status: document.getElementById('editStatus').value,
  };

  if (!updates.data || updates.data.length < 10) {
    showToast('Data inválida!', 'error');
    return;
  }

  try {
    const result = await window.api.put(`/cp/registros/${window.edicaoData.id}`, updates);
    if (result.success) {
      showToast('Registro atualizado com sucesso!', 'success');
      fecharEdicao();
      await loadAllData();
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Toast ──────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}
