/**
 * Missão Família - Simulador de Orçamento Familiar
 * Lógica do Painel Administrativo (Assíncrona)
 */

import { engine } from './state.js';

export function initAdminView() {
  // --- NAVEGAÇÃO DE ABAS DO ADMIN ---
  const tabBtns = document.querySelectorAll('.admin-nav-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      // Remover active
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Adicionar active
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      // Recarregar aba correspondente
      await refreshAdminTab(tabId);
    });
  });

  // --- SUBMISSÃO DE CONFIGURAÇÃO DE CAMPANHA ---
  const formConfig = document.getElementById('form-campaign-config');
  if (formConfig) {
    formConfig.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newSettings = {
        name: document.getElementById('cfg-camp-name').value,
        difficulty: document.getElementById('cfg-camp-difficulty').value,
        durationWeeks: parseInt(document.getElementById('cfg-camp-duration').value),
        fixedSalary: parseInt(document.getElementById('cfg-camp-salary').value),
        expensesPercentages: {
          alimentacao: parseInt(document.getElementById('cfg-perc-food').value) || 0,
          moradia: parseInt(document.getElementById('cfg-perc-housing').value) || 0,
          transporte: parseInt(document.getElementById('cfg-perc-transport').value) || 0,
          saude: parseInt(document.getElementById('cfg-perc-health').value) || 0,
          educacao: parseInt(document.getElementById('cfg-perc-education').value) || 0,
          lazer: parseInt(document.getElementById('cfg-perc-leisure').value) || 0
        },
        lateFee: parseFloat(document.getElementById('cfg-fee-late').value) || 0,
        interestRate: parseFloat(document.getElementById('cfg-interest-monthly').value) || 0,
        loanConfig: {
          minRate: parseFloat(document.getElementById('cfg-loan-min-rate').value) || 3,
          maxRate: parseFloat(document.getElementById('cfg-loan-max-rate').value) || 8,
          minTerm: parseInt(document.getElementById('cfg-loan-min-term').value) || 3,
          maxTerm: parseInt(document.getElementById('cfg-loan-max-term').value) || 12
        },
        weights: {
          health: parseInt(document.getElementById('cfg-w-health').value) || 30,
          happiness: parseInt(document.getElementById('cfg-w-happiness').value) || 30,
          finance: parseInt(document.getElementById('cfg-w-finance').value) || 25,
          cleanliness: parseInt(document.getElementById('cfg-w-cleanliness').value) || 15
        }
      };

      const res = await engine.updateCampaignSettings(newSettings);
      if (res.success) {
        alert(res.message);
        await refreshAdminTab('admin-campaign');
      } else {
        alert(res.message || 'Erro ao salvar configurações.');
      }
    });
  }

  // --- CADASTRO DE ALUNOS ---
  const formRegister = document.getElementById('form-register-participant');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-part-name').value;
      const clube = document.getElementById('reg-part-clube').value;
      const unidade = document.getElementById('reg-part-unidade').value;
      const age = document.getElementById('reg-part-age').value;

      const newPart = await engine.registerParticipant(name, clube, unidade, age);
      if (newPart) {
        alert(`Ficha cadastrada! O desbravador poderá logar no simulador.`);
        formRegister.reset();
        await refreshAdminTab('admin-participants');
        
        // Atualiza seletores de participantes
        if (window.updateParticipantSelectors) {
          await window.updateParticipantSelectors();
        }
      } else {
        alert('Erro ao cadastrar participante.');
      }
    });
  }

  // --- BOTÕES DE EXPORTAÇÃO ---
  const btnPdf = document.getElementById('btn-export-pdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      window.print();
    });
  }

  const btnExcel = document.getElementById('btn-export-excel');
  if (btnExcel) {
    btnExcel.addEventListener('click', async () => {
      await exportRankingToCSV();
    });
  }
}

// Atualizar aba específica
export async function refreshAdminTab(tabId) {
  switch (tabId) {
    case 'admin-dashboard':
      await renderAdminDashboard();
      break;
    case 'admin-campaign':
      await renderCampaignSettings();
      break;
    case 'admin-approvals':
      await renderApprovalsList();
      break;
    case 'admin-participants':
      await renderParticipantsList();
      break;
    case 'admin-audit':
      await renderAuditLogs();
      break;
  }
}

// 1. Renderizar Dashboard & Ranking
async function renderAdminDashboard() {
  const participants = await engine.getParticipants();
  const campaign = await engine.getActiveCampaign();

  // Atualizar Stats Cards
  document.getElementById('stat-total-participants').textContent = participants.length;
  
  if (participants.length > 0) {
    const totalNetWorth = participants.reduce((sum, p) => {
      const liquid = p.balance + p.reserve + Object.values(p.investments).reduce((s, v) => s + v, 0);
      const debts = p.overdueBills.reduce((s, b) => s + (b.totalValue || b.value), 0) +
                    p.loans.reduce((s, l) => s + (l.totalAmount - (l.paidTerms * l.monthlyPayment)), 0);
      return sum + (liquid - debts);
    }, 0);
    const avgNetWorth = Math.round(totalNetWorth / participants.length);
    document.getElementById('stat-avg-networth').textContent = `R$ ${avgNetWorth.toLocaleString('pt-BR')}`;

    const totalHealth = participants.reduce((sum, p) => sum + p.indicators.health, 0);
    document.getElementById('stat-avg-health').textContent = `${Math.round(totalHealth / participants.length)}%`;

    const totalHappiness = participants.reduce((sum, p) => sum + p.indicators.happiness, 0);
    document.getElementById('stat-avg-happiness').textContent = `${Math.round(totalHappiness / participants.length)}%`;
  } else {
    document.getElementById('stat-avg-networth').textContent = 'R$ 0';
    document.getElementById('stat-avg-health').textContent = '0%';
    document.getElementById('stat-avg-happiness').textContent = '0%';
  }

  // Renderizar Ranking
  const tableBody = document.querySelector('#table-ranking tbody');
  tableBody.innerHTML = '';

  if (participants.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="10" class="empty-state-text" style="text-align:center;">Nenhum desbravador cadastrado na campanha.</td></tr>`;
    return;
  }

  const ranked = participants.map(p => {
    const liquid = p.balance + p.reserve + Object.values(p.investments).reduce((s, v) => s + v, 0);
    const debts = p.overdueBills.reduce((s, b) => s + (b.totalValue || b.value), 0) +
                  p.loans.reduce((s, l) => s + (l.totalAmount - (l.paidTerms * l.monthlyPayment)), 0);
    const netWorth = liquid - debts;
    const score = engine.calculateFinalScore(p, campaign);
    
    // Contar objetivos concluídos
    const goalsCompleted = p.goalsStatus ? Object.values(p.goalsStatus).filter(s => s === 'completed').length : 0;
    const totalGoals = campaign.goals ? campaign.goals.length : 0;

    return { participant: p, netWorth, score, goalsCompleted, totalGoals };
  }).sort((a, b) => b.score - a.score);

  ranked.forEach((item, index) => {
    const p = item.participant;
    const row = document.createElement('tr');
    
    let posStr = index + 1;
    if (index === 0) posStr = '🥇';
    else if (index === 1) posStr = '🥈';
    else if (index === 2) posStr = '🥉';

    row.innerHTML = `
      <td><strong>${posStr}</strong></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.clube} / ${p.unidade}</td>
      <td><span class="badge-info">Mês ${p.week}</span></td>
      <td><span class="badge-success">${p.indicators.health}%</span></td>
      <td><span class="badge-warning">${p.indicators.happiness}%</span></td>
      <td><span class="badge-info">${p.indicators.cleanliness}%</span></td>
      <td class="${item.netWorth >= 0 ? 'green-text' : 'red-text'}"><strong>R$ ${item.netWorth.toFixed(2)}</strong></td>
      <td>${item.goalsCompleted}/${item.totalGoals}</td>
      <td><span class="badge-success" style="font-size:0.95rem; padding: 4px 10px;">${item.score} pts</span></td>
    `;
    tableBody.appendChild(row);
  });
}

// 2. Carregar configurações
async function renderCampaignSettings() {
  const campaign = await engine.getActiveCampaign();
  if (!campaign) return;

  document.getElementById('cfg-camp-name').value = campaign.name;
  document.getElementById('cfg-camp-difficulty').value = campaign.difficulty;
  document.getElementById('cfg-camp-duration').value = campaign.durationWeeks;
  document.getElementById('cfg-camp-salary').value = campaign.fixedSalary;

  const exp = campaign.expensesPercentages;
  document.getElementById('cfg-perc-food').value = exp.alimentacao;
  document.getElementById('cfg-perc-housing').value = exp.moradia;
  document.getElementById('cfg-perc-transport').value = exp.transporte;
  document.getElementById('cfg-perc-health').value = exp.saude;
  document.getElementById('cfg-perc-education').value = exp.educacao;
  document.getElementById('cfg-perc-leisure').value = exp.lazer;

  document.getElementById('cfg-fee-late').value = campaign.lateFee;
  document.getElementById('cfg-interest-monthly').value = campaign.interestRate;

  const loan = campaign.loanConfig;
  document.getElementById('cfg-loan-min-rate').value = loan.minRate;
  document.getElementById('cfg-loan-max-rate').value = loan.maxRate;
  document.getElementById('cfg-loan-min-term').value = loan.minTerm;
  document.getElementById('cfg-loan-max-term').value = loan.maxTerm;

  const w = campaign.weights;
  document.getElementById('cfg-w-health').value = w.health;
  document.getElementById('cfg-w-happiness').value = w.happiness;
  document.getElementById('cfg-w-finance').value = w.finance;
  document.getElementById('cfg-w-cleanliness').value = w.cleanliness;
}

// 3. Renderizar Filas de Aprovação
async function renderApprovalsList() {
  const participants = await engine.getParticipants();
  
  const loanContainer = document.getElementById('loans-approval-list');
  const incomeContainer = document.getElementById('income-approval-list');
  
  loanContainer.innerHTML = '';
  incomeContainer.innerHTML = '';

  let totalPending = 0;

  participants.forEach(p => {
    // A. Empréstimos Pendentes
    p.pendingLoans.forEach(req => {
      totalPending++;
      const card = document.createElement('div');
      card.className = 'approval-card';
      card.innerHTML = `
        <div class="approval-card-header">
          <span>Solicitante: <strong>${p.name}</strong></span>
          <span>${new Date(req.date).toLocaleDateString()}</span>
        </div>
        <div class="approval-card-body">
          <p>Valor Solicitado: <strong class="green-text">R$ ${req.amount.toLocaleString('pt-BR')}</strong></p>
          <p>Parcelas: <strong>${req.term} meses</strong> | Juros: <strong>${req.rate}% a.m.</strong></p>
          <p>Parcela Mensal: <strong>R$ ${req.monthlyPayment.toFixed(2)}</strong> | Total: <strong>R$ ${req.totalAmount.toFixed(2)}</strong></p>
          <p style="font-size:0.8rem; background:rgba(255,255,255,0.03); padding:6px; border-radius:4px; margin-top:8px;">
            💬 <em>"${req.justification}"</em>
          </p>
          
          <div class="loan-modification-box" style="margin-top:10px; border-top:1px dashed var(--border-color); padding-top:10px;">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">Ajustes de Aprovação:</span>
            <div class="form-row-multi" style="margin-top:5px;">
              <input type="number" id="mod-amount-${req.id}" class="input-modern btn-small" placeholder="Valor R$" value="${req.amount}" style="padding: 2px 5px; font-size:0.75rem;">
              <input type="number" id="mod-term-${req.id}" class="input-modern btn-small" placeholder="Parc." value="${req.term}" style="padding: 2px 5px; font-size:0.75rem;">
              <input type="number" id="mod-rate-${req.id}" class="input-modern btn-small" placeholder="Taxa %" value="${req.rate}" step="0.1" style="padding: 2px 5px; font-size:0.75rem;">
            </div>
          </div>
        </div>
        <div class="approval-card-actions">
          <button class="btn-primary btn-small btn-approve-loan" data-part="${p.id}" data-loan="${req.id}">✔️ Aprovar</button>
          <button class="btn-danger btn-small btn-reject-loan" data-part="${p.id}" data-loan="${req.id}">❌ Recusar</button>
        </div>
      `;
      loanContainer.appendChild(card);
    });

    // B. Rendas Extras Pendentes
    p.customExtraIncomePending.forEach(req => {
      totalPending++;
      const card = document.createElement('div');
      card.className = 'approval-card';
      card.innerHTML = `
        <div class="approval-card-header">
          <span>Proponente: <strong>${p.name}</strong></span>
          <span>${new Date(req.date).toLocaleDateString()}</span>
        </div>
        <div class="approval-card-body">
          <p>Atividade: <strong>${req.name}</strong></p>
          <p>Valor Esperado: <strong class="green-text">R$ ${req.estimatedReward.toLocaleString('pt-BR')}</strong></p>
          <p style="font-size:0.8rem; background:rgba(255,255,255,0.03); padding:6px; border-radius:4px; margin-top:8px;">
            📝 <em>"${req.description}"</em>
          </p>
        </div>
        <div class="approval-card-actions">
          <button class="btn-primary btn-small btn-approve-income" data-part="${p.id}" data-act="${req.id}">✔️ Aprovar</button>
          <button class="btn-danger btn-small btn-reject-income" data-part="${p.id}" data-act="${req.id}">❌ Recusar</button>
        </div>
      `;
      incomeContainer.appendChild(card);
    });
  });

  // Tratar badges e vazios
  const badgeCount = document.getElementById('badge-approvals-count');
  if (totalPending > 0) {
    badgeCount.textContent = totalPending;
    badgeCount.style.display = 'inline-block';
  } else {
    badgeCount.style.display = 'none';
  }

  if (loanContainer.children.length === 0) {
    loanContainer.innerHTML = '<p class="empty-state-text">Nenhuma solicitação de empréstimo pendente.</p>';
  }
  if (incomeContainer.children.length === 0) {
    incomeContainer.innerHTML = '<p class="empty-state-text">Nenhuma proposta de renda extra pendente.</p>';
  }

  setupApprovalsClickHandlers();
}

function setupApprovalsClickHandlers() {
  document.querySelectorAll('.btn-approve-loan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const partId = btn.getAttribute('data-part');
      const loanId = btn.getAttribute('data-loan');
      
      const modifiedParams = {
        amount: document.getElementById(`mod-amount-${loanId}`).value,
        term: document.getElementById(`mod-term-${loanId}`).value,
        rate: document.getElementById(`mod-rate-${loanId}`).value
      };

      const res = await engine.processLoanRequest(partId, loanId, 'approved', modifiedParams);
      alert(res.message);
      await renderApprovalsList();
    });
  });

  document.querySelectorAll('.btn-reject-loan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const partId = btn.getAttribute('data-part');
      const loanId = btn.getAttribute('data-loan');
      
      const res = await engine.processLoanRequest(partId, loanId, 'rejected');
      alert(res.message);
      await renderApprovalsList();
    });
  });

  document.querySelectorAll('.btn-approve-income').forEach(btn => {
    btn.addEventListener('click', async () => {
      const partId = btn.getAttribute('data-part');
      const actId = btn.getAttribute('data-act');
      
      const res = await engine.processCustomIncomeRequest(partId, actId, 'approved');
      alert(res.message);
      await renderApprovalsList();
    });
  });

  document.querySelectorAll('.btn-reject-income').forEach(btn => {
    btn.addEventListener('click', async () => {
      const partId = btn.getAttribute('data-part');
      const actId = btn.getAttribute('data-act');
      
      const res = await engine.processCustomIncomeRequest(partId, actId, 'rejected');
      alert(res.message);
      await renderApprovalsList();
    });
  });
}

// 4. Renderizar Lista de Participantes
async function renderParticipantsList() {
  const participants = await engine.getParticipants();
  const tableBody = document.querySelector('#table-participants-list tbody');
  tableBody.innerHTML = '';

  if (participants.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state-text" style="text-align:center;">Nenhum desbravador cadastrado.</td></tr>`;
    return;
  }

  participants.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.clube} / ${p.unidade}</td>
      <td>${p.age} anos</td>
      <td><span class="badge-info">${p.family.name}</span></td>
      <td>Mês ${p.week}</td>
      <td>
        <button class="btn-primary btn-small btn-simulate-player" data-id="${p.id}">🎮 Simular Família</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll('.btn-simulate-player').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.getAttribute('data-id');
      
      const profileSel = document.getElementById('profile-selector');
      profileSel.value = 'participant';
      profileSel.dispatchEvent(new Event('change'));
      
      const partSel = document.getElementById('participant-selector');
      partSel.value = pId;
      partSel.dispatchEvent(new Event('change'));
    });
  });
}

// 5. Renderizar Auditoria
async function renderAuditLogs() {
  const logs = await engine.getAuditLogs();
  const tableBody = document.querySelector('#table-audit-logs tbody');
  tableBody.innerHTML = '';

  if (logs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state-text" style="text-align:center;">Nenhum registro de auditoria.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(log.timestamp).toLocaleString()}</td>
      <td><strong>${log.username}</strong></td>
      <td><span class="badge-info">${log.action}</span></td>
      <td style="font-size:0.85rem;">${log.details}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Exportar Ranking CSV
async function exportRankingToCSV() {
  const participants = await engine.getParticipants();
  const campaign = await engine.getActiveCampaign();

  if (participants.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }

  const csvRows = [];
  csvRows.push(['Classificacao', 'Nome', 'Clube', 'Unidade', 'Mes Simulacao', 'Saude', 'Felicidade', 'Limpeza', 'Patrimonio Liquido', 'Pontos Totais'].join(';'));

  const ranked = participants.map(p => {
    const liquid = p.balance + p.reserve + Object.values(p.investments).reduce((s, v) => s + v, 0);
    const debts = p.overdueBills.reduce((s, b) => s + (b.totalValue || b.value), 0) +
                  p.loans.reduce((s, l) => s + (l.totalAmount - (l.paidTerms * l.monthlyPayment)), 0);
    const netWorth = liquid - debts;
    const score = engine.calculateFinalScore(p, campaign);
    return { p, netWorth, score };
  }).sort((a, b) => b.score - a.score);

  ranked.forEach((item, index) => {
    const row = [
      index + 1,
      item.p.name,
      item.p.clube,
      item.p.unidade,
      item.p.week,
      `${item.p.indicators.health}%`,
      `${item.p.indicators.happiness}%`,
      `${item.p.indicators.cleanliness}%`,
      `R$ ${item.netWorth.toFixed(2)}`,
      item.score
    ];
    csvRows.push(row.join(';'));
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Ranking_Simulador_Missao_Familia_${campaign.name.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
