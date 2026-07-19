/**
 * Missão Família - Simulador de Orçamento Familiar
 * Lógica do Participante (Casa Virtual - Assíncrona)
 */

import { engine } from './state.js';
import { 
  DEFAULT_TASKS, 
  DEFAULT_EXTRA_INCOME_ACTIVITIES, 
  DEFAULT_INVESTMENT_PRODUCTS,
  INITIAL_DIFFICULTIES
} from './mockData.js';

let activeOpenModalId = null;
let currentInvProductAction = null; // 'cdb', 'poupanca', etc.
let currentInvActionType = null;    // 'deposit' ou 'withdraw'

const LEISURE_OPTIONS = [
  { id: 'streaming', name: 'Filme em Casa (Streaming)', cost: 15, happiness: 5, energy: 5, emoji: '📺', description: 'Assista a um filme legal reunindo a família na sala.' },
  { id: 'park', name: 'Passeio no Parque / Piquenique', cost: 40, happiness: 10, energy: 10, emoji: '🧺', description: 'Dia de sol, ar livre e comunhão com a natureza no parque.' },
  { id: 'cinema', name: 'Cinema & Lanches em Família', cost: 120, happiness: 22, energy: 15, emoji: '🍿', description: 'Uma saída especial para assistir a uma estreia e comer pipoca.' },
  { id: 'trip', name: 'Viagem de Fim de Semana', cost: 500, happiness: 50, energy: 25, emoji: '🏕️', description: 'Acampamento ou passeio em parque temático no fim de semana.' }
];

export function initParticipantView() {
  // --- NAVEGAÇÃO DE MODAIS (AMBIENTES) ---
  const roomCards = document.querySelectorAll('.room-card');
  const closeBtns = document.querySelectorAll('.btn-close-modal');

  roomCards.forEach(card => {
    card.addEventListener('click', async () => {
      const modalId = card.getAttribute('data-modal');
      await openParticipantModal(modalId);
    });
  });

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      closeParticipantModal();
    });
  });

  // Fechar clicando fora
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeParticipantModal();
      }
    });
  });

  // --- BOTÃO DE AVANÇO MENSAL (FECHAMENTO PELO ALUNO REMOVIDO / DESATIVADO) ---
  const btnAdvance = document.getElementById('btn-advance-month');
  if (btnAdvance) {
    btnAdvance.addEventListener('click', () => {
      alert("Apenas o Diretor do Clube de Desbravadores pode fechar o mês no simulador.");
    });
  }

  // --- BOTÃO MANUAL DE TRANSIÇÃO DE DIA (SIMULAÇÃO) ---
  const btnNextDay = document.getElementById('btn-next-day');
  if (btnNextDay) {
    btnNextDay.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      if (!currentId) return;

      btnNextDay.disabled = true;
      const res = await engine.nextDay(currentId);
      alert(res.message);
      btnNextDay.disabled = false;

      if (res.success) {
        await refreshParticipantView();
      }
    });
  }

  // --- BOTÃO MANUAL DE AVANÇO MENSAL (SIMULAÇÃO ADMIN) ---
  const btnAdminAdvance = document.getElementById('btn-admin-advance-month');
  if (btnAdminAdvance) {
    btnAdminAdvance.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      if (!currentId) return;

      if (confirm("Você está simulando como ADMIN. Deseja forçar o avanço de mês/ciclo para este participante específico? Isso fechará as contas e gerará as faturas do próximo mês sem afetar outros alunos.")) {
        btnAdminAdvance.disabled = true;
        const res = await engine.advanceCycleAdmin(currentId);
        alert(res.message);
        btnAdminAdvance.disabled = false;

        if (res.success) {
          await refreshParticipantView();
        }
      }
    });
  }

  // --- FORMULÁRIO DE EMPRÉSTIMO ---
  const formLoan = document.getElementById('form-request-loan');
  if (formLoan) {
    formLoan.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const amount = parseFloat(document.getElementById('loan-amount').value);
      const term = parseInt(document.getElementById('loan-term').value);
      const justification = document.getElementById('loan-justification').value;

      const res = await engine.requestLoan(currentId, amount, term, justification);
      alert(res.message);
      if (res.success) {
        formLoan.reset();
        document.getElementById('loan-preview-box').style.display = 'none';
        await renderModalContent('modal-bank');
        await refreshParticipantView();
      }
    });

    const loanAmtInput = document.getElementById('loan-amount');
    const loanTermInput = document.getElementById('loan-term');
    const previewBox = document.getElementById('loan-preview-box');

    const updateLoanPreview = async () => {
      const amount = parseFloat(loanAmtInput.value) || 0;
      const term = parseInt(loanTermInput.value) || 0;
      const campaign = await engine.getActiveCampaign();

      if (amount >= campaign.loanConfig.minVal && term >= campaign.loanConfig.minTerm) {
        const estRate = (campaign.loanConfig.minRate + campaign.loanConfig.maxRate) / 2;
        const monthlyRate = estRate / 100;
        const pmt = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
        const total = pmt * term;

        document.getElementById('preview-rate').textContent = `${estRate.toFixed(1)}% a.m. (média)`;
        document.getElementById('preview-pmt').textContent = `R$ ${pmt.toFixed(2)}`;
        document.getElementById('preview-total').textContent = `R$ ${total.toFixed(2)}`;
        previewBox.style.display = 'block';
      } else {
        previewBox.style.display = 'none';
      }
    };

    loanAmtInput.addEventListener('input', updateLoanPreview);
    loanTermInput.addEventListener('input', updateLoanPreview);
  }

  // --- FORMULÁRIO DE RESERVA DE EMERGÊNCIA ---
  const btnReserveDep = document.getElementById('btn-reserve-deposit');
  const btnReserveWith = document.getElementById('btn-reserve-withdraw');
  const reserveAmtInput = document.getElementById('input-reserve-amount');

  if (btnReserveDep) {
    btnReserveDep.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const amt = parseFloat(reserveAmtInput.value) || 0;
      const res = await engine.manageReserve(currentId, 'deposit', amt);
      alert(res.message);
      if (res.success) {
        reserveAmtInput.value = '';
        await renderModalContent('modal-bank');
        await refreshParticipantView();
      }
    });
  }

  if (btnReserveWith) {
    btnReserveWith.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const amt = parseFloat(reserveAmtInput.value) || 0;
      const res = await engine.manageReserve(currentId, 'withdraw', amt);
      alert(res.message);
      if (res.success) {
        reserveAmtInput.value = '';
        await renderModalContent('modal-bank');
        await refreshParticipantView();
      }
    });
  }

  // --- COMPRA DE ALIMENTOS NO MERCADO ---
  document.querySelectorAll('.btn-buy-food').forEach(btn => {
    btn.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const option = btn.getAttribute('data-option');
      const res = await engine.buyMarketFood(currentId, option);
      alert(res.message);
      if (res.success) {
        await refreshParticipantView();
        await renderModalContent('modal-market');
      }
    });
  });

  // --- FORMULÁRIO DE PROPOSTA DE RENDA EXTRA ---
  const formCustomInc = document.getElementById('form-custom-income');
  if (formCustomInc) {
    formCustomInc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const name = document.getElementById('custom-inc-name').value;
      const desc = document.getElementById('custom-inc-desc').value;
      const reward = parseFloat(document.getElementById('custom-inc-reward').value);

      const res = await engine.submitCustomExtraIncome(currentId, name, desc, reward);
      alert(res.message);
      if (res.success) {
        formCustomInc.reset();
        await refreshParticipantView();
      }
    });
  }

  // --- SUBMIT DE MODAL DE INVESTIMENTO ---
  const btnInvSubmit = document.getElementById('btn-inv-submit');
  const inputInvAmt = document.getElementById('inv-action-amount');
  const overlayInvAction = document.getElementById('modal-investment-action');
  const btnCloseInvAct = document.getElementById('btn-close-inv-action');

  if (btnCloseInvAct) {
    btnCloseInvAct.addEventListener('click', () => {
      overlayInvAction.style.display = 'none';
    });
  }

  if (btnInvSubmit) {
    btnInvSubmit.addEventListener('click', async () => {
      const currentId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const amount = parseFloat(inputInvAmt.value) || 0;
      
      let res;
      if (currentInvActionType === 'deposit') {
        res = await engine.investMoney(currentId, currentInvProductAction, amount);
      } else {
        res = await engine.withdrawInvestment(currentId, currentInvProductAction, amount);
      }

      alert(res.message);
      if (res.success) {
        inputInvAmt.value = '';
        overlayInvAction.style.display = 'none';
        await renderModalContent('modal-investments');
        await refreshParticipantView();
      }
    });
  }
}

// Abrir Modal de Quarto
async function openParticipantModal(modalId) {
  activeOpenModalId = modalId;
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.style.display = 'flex';
    await renderModalContent(modalId);
  }
}

// Fechar modal ativo
function closeParticipantModal() {
  if (activeOpenModalId) {
    const overlay = document.getElementById(activeOpenModalId);
    if (overlay) overlay.style.display = 'none';
    activeOpenModalId = null;
  }
}

// Renderizar painel geral
export async function refreshParticipantView() {
  const pId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
  if (!pId) return;

  try {
    const p = await engine.getParticipantById(pId);
    if (!p) return;

    // Header dados
    document.getElementById('player-family-name').textContent = `Família de ${p.name}`;
    document.getElementById('player-family-desc').textContent = `${p.family.name} (${p.clube} / ${p.unidade})`;
    document.getElementById('player-calendar-week').textContent = `📅 Mês ${p.week} - Dia ${p.day || 1} / 30`;

    // Mostrar/esconder botões de simulação baseando-se no papel (role) do usuário logado
    const btnNextDay = document.getElementById('btn-next-day');
    const btnAdminAdvance = document.getElementById('btn-admin-advance-month');
    
    if (engine.currentUser && engine.currentUser.role === 'admin') {
      if (btnNextDay) btnNextDay.style.display = 'inline-block';
      if (btnAdminAdvance) btnAdminAdvance.style.display = 'inline-block';
    } else {
      if (btnNextDay) btnNextDay.style.display = 'none';
      if (btnAdminAdvance) btnAdminAdvance.style.display = 'none';
    }

    // Barra de Indicadores (%)
    const updateBar = (id, barId, valId) => {
      const val = p.indicators[id];
      document.getElementById(valId).textContent = `${val}%`;
      document.getElementById(barId).style.width = `${val}%`;
    };
    
    updateBar('health', 'bar-indicator-health', 'val-indicator-health');
    updateBar('happiness', 'bar-indicator-happiness', 'val-indicator-happiness');
    updateBar('cleanliness', 'bar-indicator-cleanliness', 'val-indicator-cleanliness');
    updateBar('financial', 'bar-indicator-finance', 'val-indicator-finance');

    // Recurso Financeiro
    document.getElementById('player-cash-val').textContent = `R$ ${p.balance.toFixed(2)}`;
    document.getElementById('player-reserve-val').textContent = `R$ ${p.reserve.toFixed(2)}`;
    document.getElementById('player-salary-val').textContent = `R$ ${p.salary.toFixed(2)}`;
    document.getElementById('val-player-energy').textContent = `${p.energy}%`;
    
    const cleaningStockEl = document.getElementById('player-cleaning-stock-val');
    if (cleaningStockEl) {
      cleaningStockEl.textContent = `${p.cleaningProductsStock || 0} cargas`;
    }

    // Badges da Home
    const unpaidCount = p.unpaidBills.length;
    const badgeBills = document.getElementById('badge-unpaid-bills');
    if (unpaidCount > 0) {
      badgeBills.textContent = unpaidCount;
      badgeBills.style.display = 'flex';
    } else {
      badgeBills.style.display = 'none';
    }

    const badgeSick = document.getElementById('badge-sick-family');
    if (p.activeIllnesses.length > 0) {
      badgeSick.style.display = 'flex';
    } else {
      badgeSick.style.display = 'none';
    }

    // Badge de Manutenções pendentes
    const breakdownCount = p.activeEvents.filter(e => e.isBreakdown).length;
    const badgeMaint = document.getElementById('badge-maintenance');
    if (badgeMaint) {
      if (breakdownCount > 0) {
        badgeMaint.textContent = breakdownCount;
        badgeMaint.style.display = 'flex';
      } else {
        badgeMaint.style.display = 'none';
      }
    }

    // Notificações feed
    const notifContainer = document.getElementById('player-notifications-list');
    if (notifContainer) {
      notifContainer.innerHTML = '';
      if (p.notifications.length === 0) {
        notifContainer.innerHTML = '<p class="empty-state-text">Nenhuma notificação recente.</p>';
      } else {
        p.notifications.slice(0, 15).forEach(n => {
          const item = document.createElement('div');
          item.className = `notif-item ${n.type || 'info'}`;
          item.textContent = n.text;
          notifContainer.appendChild(item);
        });
      }
    }

    // Atualizar Planta da Casa Visual & Quadro da Família
    updateVisualHouseAndFamily(p);
  } catch (err) {
    console.error("Erro ao recarregar a visualização do participante:", err);
  }
}

// Renderizar o conteúdo do modal aberto
async function renderModalContent(modalId) {
  const pId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
  const p = await engine.getParticipantById(pId);
  const campaign = await engine.getActiveCampaign();
  if (!p || !campaign) return;

  switch (modalId) {
    
    // 1. SALA PRINCIPAL / NARRADOR
    case 'modal-hall': {
      const alertContainer = document.getElementById('hall-active-alerts-container');
      alertContainer.innerHTML = '';

      let alertsFound = false;

      // Doenças
      p.activeIllnesses.forEach(ill => {
        alertsFound = true;
        const alertCard = document.createElement('div');
        alertCard.className = 'alert-item-card danger';
        alertCard.innerHTML = `
          <div>
            <h5>🤒 Doença Familiar: ${ill.name}</h5>
            <p>${ill.description} Impacto: Saúde (${ill.healthImpact}%), Felicidade (${ill.happinessImpact}%)</p>
            <p class="alert-tip">💊 Medicamento necessário: <strong>${ill.requiredMedicine} (Custo R$ ${ill.medicineCost})</strong>. Compre na Farmácia.</p>
          </div>
        `;
        alertContainer.appendChild(alertCard);
      });

      // Eventos e Quebras
      p.activeEvents.forEach(evt => {
        alertsFound = true;
        const alertCard = document.createElement('div');
        const isBreak = evt.isBreakdown;
        alertCard.className = `alert-item-card ${isBreak ? 'danger' : 'warning'}`;
        alertCard.innerHTML = `
          <div>
            <h5>${isBreak ? '🛠️ QUEBRA ESTRUTURAL' : '⚠️ Evento Ocorrido'}: ${evt.name}</h5>
            <p>${evt.description} ${isBreak ? 'Custo de reparo: R$ ' + evt.repairCost : 'Impacto financeiro: R$ ' + evt.impact}</p>
            <p class="alert-tip">${isBreak ? '🔧 Acesse a aba **Consertos da Casa** para pagar o encanador/eletricista.' : '💡 Conselho: ' + evt.tip}</p>
          </div>
        `;
        alertContainer.appendChild(alertCard);
      });

      if (!p.boughtFoodThisMonth) {
        alertsFound = true;
        const alertCard = document.createElement('div');
        alertCard.className = 'alert-item-card danger';
        alertCard.innerHTML = `
          <div>
            <h5>🛒 Despensa Vazia (Risco de Fome)</h5>
            <p>Sua família ainda não tem alimentos registrados para este mês.</p>
            <p class="alert-tip">🍎 **IMPORTANTE**: Compre comida no Supermercado antes do final do mês ou a Saúde e Felicidade cairão para 0%!</p>
          </div>
        `;
        alertContainer.appendChild(alertCard);
      }

      if (!alertsFound) {
        alertContainer.innerHTML = '<p class="success-text">✔️ Tudo sob controle na residência! Nenhum evento de crise ou doença ativa.</p>';
      }

      const narratorText = document.getElementById('narrator-text');
      const narratorTitle = document.getElementById('narrator-title');
      
      if (p.indicators.health < 50) {
        narratorTitle.textContent = "🏥 Alerta Médico (Conselheiro):";
        narratorText.textContent = "A saúde da família está caindo! Certifique-se de comprar comida equilibrada/premium no Mercado ou compre medicamentos se alguém estiver doente.";
      } else if (p.indicators.cleanliness < 40) {
        narratorTitle.textContent = "🧹 Conselheiro Familiar (Limpeza):";
        narratorText.textContent = "A casa está muito suja. Vá nas 'Tarefas Domésticas' e limpe a casa ou lave a louça para evitar a proliferação de pragas.";
      } else if (p.balance < 100 && p.reserve === 0) {
        narratorTitle.textContent = "💸 Conselheiro Financeiro:";
        narratorText.textContent = "Seu caixa está quase zerado e você não tem reserva! Experimente fazer renda extra (vender doces ou passear com cães) no trabalho.";
      } else if (p.overdueBills.length > 0) {
        narratorTitle.textContent = "🚨 Alerta de Contas:";
        narratorText.textContent = "Você tem faturas em atraso correndo juros e multa. Pague-as o quanto antes no menu 'Contas a Pagar' para recuperar a felicidade.";
      } else {
        narratorTitle.textContent = "🧓 Conselheiro Familiar:";
        narratorText.textContent = "Excelente administração até o momento! Compre alimentos, faça tarefas para manter a higiene e divirta-se moderadamente.";
      }
      break;
    }

    // 2. BANCO VIRTUAL
    case 'modal-bank': {
      document.getElementById('bank-reserve-val').textContent = `R$ ${p.reserve.toFixed(2)}`;
      
      const tbody = document.querySelector('#table-active-loans tbody');
      tbody.innerHTML = '';

      if (p.loans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state-text" style="text-align:center;">Nenhum empréstimo ativo no momento.</td></tr>';
      } else {
        p.loans.forEach(l => {
          const row = document.createElement('tr');
          const dateStr = l.dateApproved ? new Date(l.dateApproved).toLocaleDateString() : 'Inicial';
          const remainingTerms = l.term - l.paidTerms;
          const statusStr = remainingTerms === 0 ? '<span class="badge-success">Quitado</span>' : '<span class="badge-warning">Em Pagamento</span>';
          
          row.innerHTML = `
            <td>${dateStr}</td>
            <td>R$ ${l.amount.toFixed(2)}</td>
            <td>${l.rate}% a.m.</td>
            <td>${l.paidTerms} / ${l.term} meses</td>
            <td>R$ ${l.monthlyPayment.toFixed(2)}</td>
            <td>R$ ${(l.monthlyPayment * remainingTerms).toFixed(2)}</td>
            <td>${statusStr}</td>
          `;
          tbody.appendChild(row);
        });
      }
      break;
    }

    // 3. MERCADO
    case 'modal-market': {
      const sizeMult = p.family.baseExpensesMultiplier;
      const diff = INITIAL_DIFFICULTIES[campaign.difficulty];

      document.getElementById('val-price-food-basic').textContent = `R$ ${Math.round(150 * sizeMult * diff.costMultiplier).toFixed(2)}`;
      document.getElementById('val-price-food-healthy').textContent = `R$ ${Math.round(300 * sizeMult * diff.costMultiplier).toFixed(2)}`;
      document.getElementById('val-price-food-premium').textContent = `R$ ${Math.round(500 * sizeMult * diff.costMultiplier).toFixed(2)}`;
      
      document.getElementById('val-food-stock-basic').textContent = `${p.foodStockBasic || 0} cargas`;
      document.getElementById('val-food-stock-healthy').textContent = `${p.foodStockHealthy !== undefined ? p.foodStockHealthy : 5} cargas`;
      document.getElementById('val-food-stock-premium').textContent = `${p.foodStockPremium || 0} cargas`;
      document.getElementById('val-market-cleaning-products-stock').textContent = `${p.cleaningProductsStock || 0} cargas`;
      break;
    }

    // 3.5. LAZER E RECREAÇÃO (🎡 NOVO)
    case 'modal-leisure': {
      renderLeisureActivities(p);
      break;
    }

    // 3.6. CONSERTOS DA CASA (🛠️ NOVO)
    case 'modal-maintenance': {
      renderMaintenanceProblems(p);
      break;
    }

    // 4. FARMÁCIA
    case 'modal-pharmacy': {
      const list = document.getElementById('pharmacy-diseases-list');
      list.innerHTML = '';

      if (p.activeIllnesses.length === 0) {
        list.innerHTML = '<p class="success-text" style="text-align:center; padding: 2rem 0;">✔️ Toda a família está saudável! Nenhuma receita médica pendente.</p>';
      } else {
        p.activeIllnesses.forEach(ill => {
          const item = document.createElement('div');
          item.className = 'disease-buy-item';
          item.innerHTML = `
            <div class="disease-meta">
              <h4>🤒 Doença: ${ill.name}</h4>
              <p>Requer o remédio: <strong>${ill.requiredMedicine}</strong></p>
              <p style="font-size:0.75rem; color:var(--text-muted);">${ill.description}</p>
            </div>
            <div style="text-align:right;">
              <span class="price" style="display:block; font-weight:800; font-size:1.1rem; margin-bottom:5px;">R$ ${ill.medicineCost.toFixed(2)}</span>
              <button class="btn-primary btn-small btn-buy-med" data-id="${ill.id}">Comprar Remédio</button>
            </div>
          `;
          list.appendChild(item);
        });

        document.querySelectorAll('.btn-buy-med').forEach(btn => {
          btn.addEventListener('click', async () => {
            const diseaseId = btn.getAttribute('data-id');
            const res = await engine.buyMedicine(pId, diseaseId);
            alert(res.message);
            if (res.success) {
              await refreshParticipantView();
              await renderModalContent('modal-pharmacy');
            }
          });
        });
      }
      break;
    }

    // 5. TRABALHO & RENDA EXTRA
    case 'modal-work': {
      const container = document.getElementById('work-income-activities');
      container.innerHTML = '';
      
      const diff = INITIAL_DIFFICULTIES[campaign.difficulty];

      DEFAULT_EXTRA_INCOME_ACTIVITIES.forEach(act => {
        const reward = Math.round(act.baseReward * diff.incomeMultiplier);
        const costToExec = Math.round((act.executionCost || 0) * diff.costMultiplier);
        const successChance = Math.round((act.successProbability || 0.8) * 100);
        
        const isCompleted = p.extraIncomeCompletedThisWeek && p.extraIncomeCompletedThisWeek.includes(act.id);

        const card = document.createElement('div');
        card.className = 'income-item-card';
        if (isCompleted) card.style.opacity = '0.6';
        
        let impactsText = [];
        if (act.healthImpact) impactsText.push(`Saúde (${act.healthImpact >= 0 ? '+' : ''}${act.healthImpact}%)`);
        if (act.happinessImpact) impactsText.push(`Felicidade (${act.happinessImpact >= 0 ? '+' : ''}${act.happinessImpact}%)`);
        if (act.cleanlinessImpact) impactsText.push(`Limpeza (${act.cleanlinessImpact >= 0 ? '+' : ''}${act.cleanlinessImpact}%)`);

        card.innerHTML = `
          <div class="income-card-meta">
            <h4>${act.name} ${isCompleted ? '✅' : ''}</h4>
            <p>${act.description}</p>
            <p style="font-size:0.75rem; margin-top: 5px;">Tempo necessário: <strong>${act.daysRequired} dia(s)</strong> | Consumo de Energia: <strong>${act.daysRequired * 15}%</strong></p>
            <p style="font-size:0.75rem; color:#c084fc;">💸 Custo de Execução: <strong>R$ ${costToExec}</strong> | 🎲 Sucesso: <strong>${successChance}%</strong></p>
            <span class="impacts ${act.happinessImpact >= 0 ? 'green-text' : 'red-text'}">${impactsText.join(', ')}</span>
          </div>
          <div class="income-card-action">
            <span class="reward" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 2px;">Est. Retorno:</span>
            <span class="reward" style="margin-top:0;">R$ ${reward}</span>
            <button class="btn-primary btn-small btn-do-income" data-id="${act.id}" ${isCompleted ? 'disabled style="background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid transparent;"' : ''}>
              ${isCompleted ? 'Já Realizado' : 'Realizar Trabalho'}
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      document.querySelectorAll('.btn-do-income').forEach(btn => {
        btn.addEventListener('click', async () => {
          const actId = btn.getAttribute('data-id');
          const res = await engine.performExtraIncome(pId, actId);
          alert(res.message);
          if (res.success) {
            await refreshParticipantView();
            await renderModalContent('modal-work');
          }
        });
      });
      break;
    }

    // 6. INVESTIMENTOS
    case 'modal-investments': {
      document.getElementById('port-poupanca').textContent = `R$ ${(p.investments.poupanca || 0).toFixed(2)}`;
      document.getElementById('port-cdb').textContent = `R$ ${(p.investments.cdb || 0).toFixed(2)}`;
      document.getElementById('port-tesouro').textContent = `R$ ${(p.investments.tesouro_direto || 0).toFixed(2)}`;
      document.getElementById('port-fundo').textContent = `R$ ${(p.investments.fundo_acoes || 0).toFixed(2)}`;

      const prodContainer = document.getElementById('investments-products-container');
      prodContainer.innerHTML = '';

      DEFAULT_INVESTMENT_PRODUCTS.forEach(prod => {
        if (campaign.investmentsEnabled.includes(prod.id)) {
          const card = document.createElement('div');
          card.className = 'product-inv-card';
          
          const currentAmount = p.investments[prod.id] || 0;
          const yieldPercent = (prod.monthlyYield * 100).toFixed(1);

          card.innerHTML = `
            <div class="prod-meta">
              <h4>${prod.name}</h4>
              <p class="desc">${prod.description}</p>
              <div class="prod-stats">
                <span>Rendimento: <strong>${yieldPercent}% ao mês</strong></span>
                <span>Risco: <strong>${prod.risk}</strong></span>
                <span>Saldo Aplicado: <strong class="green-text">R$ ${currentAmount.toFixed(2)}</strong></span>
              </div>
            </div>
            <div class="prod-actions">
              <button class="btn-primary btn-small btn-inv-action" data-id="${prod.id}" data-type="deposit">📥 Aplicar</button>
              <button class="btn-secondary btn-small btn-inv-action" data-id="${prod.id}" data-type="withdraw" ${currentAmount <= 0 ? 'disabled' : ''}>📤 Resgatar</button>
            </div>
          `;
          prodContainer.appendChild(card);
        }
      });

      document.querySelectorAll('.btn-inv-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const prodId = btn.getAttribute('data-id');
          const type = btn.getAttribute('data-type');
          
          currentInvProductAction = prodId;
          currentInvActionType = type;
          
          const prod = DEFAULT_INVESTMENT_PRODUCTS.find(x => x.id === prodId);
          document.getElementById('inv-action-title').textContent = type === 'deposit' ? `Aplicar em ${prod.name}` : `Resgatar de ${prod.name}`;
          document.getElementById('inv-action-desc').textContent = type === 'deposit' ? `Transfira saldo da sua conta corrente para aplicar.` : `Resgate valores aplicados. Sujeito a taxas.`;
          
          document.getElementById('modal-investment-action').style.display = 'flex';
        });
      });
      break;
    }

    // 7. CONTAS A PAGAR
    case 'modal-bills': {
      // A. Contas A Vencer
      const unpaidContainer = document.getElementById('unpaid-bills-container');
      unpaidContainer.innerHTML = '';

      if (p.unpaidBills.length === 0) {
        unpaidContainer.innerHTML = '<p class="success-text" style="text-align:center; padding: 2rem 0;">✔️ Todas as faturas deste mês foram quitadas!</p>';
      } else {
        p.unpaidBills.forEach(bill => {
          const item = document.createElement('div');
          item.className = 'bill-card-item';
          item.innerHTML = `
            <div class="bill-item-details">
              <h4>${bill.name}</h4>
              <span>Vencimento: Final do Mês ${bill.dueWeek}</span>
            </div>
            <div class="bill-item-action">
              <span class="value">R$ ${bill.value.toFixed(2)}</span>
              <button class="btn-primary btn-small btn-pay-bill" data-id="${bill.id}" data-overdue="false">Pagar Fatura</button>
            </div>
          `;
          unpaidContainer.appendChild(item);
        });
      }

      // B. Contas Em Atraso
      const overdueContainer = document.getElementById('overdue-bills-container');
      overdueContainer.innerHTML = '';

      if (p.overdueBills.length === 0) {
        overdueContainer.innerHTML = '<p class="success-text" style="text-align:center; padding: 2rem 0;">✔️ Nenhuma fatura em atraso. Excelente!</p>';
      } else {
        p.overdueBills.forEach(bill => {
          const item = document.createElement('div');
          item.className = 'bill-card-item';
          item.style.borderLeft = '4px solid var(--danger)';
          
          const val = bill.totalValue || bill.value;
          item.innerHTML = `
            <div class="bill-item-details">
              <h4 class="red-text">${bill.name}</h4>
              <span>Original: R$ ${bill.value.toFixed(2)} | Multa: R$ ${bill.fineApplied.toFixed(2)} | Juros: R$ ${bill.interestApplied.toFixed(2)}</span>
            </div>
            <div class="bill-item-action">
              <span class="value red-text">R$ ${val.toFixed(2)}</span>
              <button class="btn-danger btn-small btn-pay-bill" data-id="${bill.id}" data-overdue="true">Pagar com Juros</button>
            </div>
          `;
          overdueContainer.appendChild(item);
        });
      }

      document.querySelectorAll('.btn-pay-bill').forEach(btn => {
        btn.addEventListener('click', async () => {
          const billId = btn.getAttribute('data-id');
          const isOverdue = btn.getAttribute('data-overdue') === 'true';
          const res = await engine.payBill(pId, billId, isOverdue);
          alert(res.message);
          if (res.success) {
            await refreshParticipantView();
            await renderModalContent('modal-bills');
          }
        });
      });
      break;
    }

    // 8. TAREFAS DOMÉSTICAS
    case 'modal-chores': {
      const container = document.getElementById('chores-container');
      container.innerHTML = '';
      
      const valCleaningStock = document.getElementById('val-cleaning-products-stock');
      if (valCleaningStock) {
        valCleaningStock.textContent = `${p.cleaningProductsStock || 0} cargas`;
      }
      const valChoresBasic = document.getElementById('val-chores-food-basic');
      if (valChoresBasic) {
        valChoresBasic.textContent = `${p.foodStockBasic || 0} cargas`;
      }
      const valChoresHealthy = document.getElementById('val-chores-food-healthy');
      if (valChoresHealthy) {
        valChoresHealthy.textContent = `${p.foodStockHealthy !== undefined ? p.foodStockHealthy : 5} cargas`;
      }
      const valChoresPremium = document.getElementById('val-chores-food-premium');
      if (valChoresPremium) {
        valChoresPremium.textContent = `${p.foodStockPremium || 0} cargas`;
      }

      DEFAULT_TASKS.forEach(task => {
        const card = document.createElement('div');
        card.className = 'chore-item-card';

        let impactsHtml = [];
        if (task.cleanlinessImpact) {
          const sign = task.cleanlinessImpact > 0 ? '+' : '';
          const colorClass = task.cleanlinessImpact > 0 ? 'blue-text' : 'red-text';
          impactsHtml.push(`<span class="${colorClass}">🧹 Limpeza: ${sign}${task.cleanlinessImpact}%</span>`);
        }
        if (task.healthImpact) impactsHtml.push(`<span class="red-text">❤️ Saúde: +${task.healthImpact}%</span>`);
        impactsHtml.push(`<span class="red-text" style="color:var(--danger);">😊 Felicidade: -3% (Trabalho)</span>`);

        card.innerHTML = `
          <div class="chore-meta">
            <h4>${task.name}</h4>
            <p>${task.description}</p>
            <div class="chore-impacts-list" style="margin-top: 10px;">
              ${impactsHtml.join('')}
              <span style="display:block; color:var(--text-muted); font-size:0.75rem;">Energia necessária: <strong>${task.energyCost}%</strong></span>
              <span style="display:block; color:var(--text-muted); font-size:0.75rem;">Material de limpeza: <strong>${task.requiresCleaningProduct ? '1 carga' : 'Não consome'}</strong></span>
              ${task.id.startsWith('prepare_meals') ? `
                <span style="display:block; color:var(--text-muted); font-size:0.75rem;">Ingredientes exigidos: <strong>1 carga (${task.id === 'prepare_meals_quick' ? 'Básicos' : task.id === 'prepare_meals' ? 'Saudáveis' : 'Premium'})</strong></span>
              ` : ''}
            </div>
          </div>
          <div class="price-action" style="margin-top: 15px;">
            <span class="price" style="font-size:1.1rem; color:var(--success);">Custo: Grátis</span>
            <button class="btn-primary btn-small btn-full btn-do-chore" data-id="${task.id}">Realizar Tarefa</button>
          </div>
        `;
        container.appendChild(card);
      });

      document.querySelectorAll('.btn-do-chore').forEach(btn => {
        btn.addEventListener('click', async () => {
          const taskId = btn.getAttribute('data-id');
          const res = await engine.executeTask(pId, taskId);
          alert(res.message);
          if (res.success) {
            await refreshParticipantView();
            await renderModalContent('modal-chores');
          }
        });
      });
      break;
    }

    // 9. RELATÓRIOS & EVOLUÇÃO
    case 'modal-reports': {
      const scoreVal = engine.calculateFinalScore(p, campaign);
      document.getElementById('report-estimated-score').textContent = scoreVal;

      const listGoals = document.getElementById('report-goals-checklist');
      listGoals.innerHTML = '';

      campaign.goals.forEach(goal => {
        const status = p.goalsStatus ? p.goalsStatus[goal.id] : 'in_progress';
        const li = document.createElement('li');
        
        let statusStr = "⏳ Em Andamento";
        let classStr = "in-progress";

        if (status === 'completed') {
          statusStr = "✔️ Concluído";
          classStr = "completed";
        } else if (status === 'failed') {
          statusStr = "❌ Falhado";
          classStr = "failed";
        }

        li.className = classStr;
        li.innerHTML = `
          <div style="flex-grow:1;">
            <strong>${goal.name}</strong> <span style="font-size:0.75rem; color:var(--text-muted); display:block;">${goal.description}</span>
          </div>
          <div style="text-align:right;">
            <span class="badge-${classStr === 'completed' ? 'success' : classStr === 'failed' ? 'danger' : 'warning'}">${statusStr}</span>
            <span style="display:block; font-size:0.75rem; font-weight:bold; margin-top:2px;">+${goal.points} pts</span>
          </div>
        `;
        listGoals.appendChild(li);
      });

      const tableBody = document.querySelector('#table-timeline-history tbody');
      tableBody.innerHTML = '';

      if (!p.history || p.history.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state-text" style="text-align:center;">Ainda não há histórico consolidado. Aguarde a virada do primeiro ciclo!</td></tr>';
      } else {
        const sortedHistory = [...p.history].sort((a,b) => a.week - b.week);
        sortedHistory.forEach(snap => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><strong>Mês ${snap.week}</strong></td>
            <td><span class="badge-success">${snap.indicators.health}%</span></td>
            <td><span class="badge-warning">${snap.indicators.happiness}%</span></td>
            <td><span class="badge-info">${snap.indicators.cleanliness}%</span></td>
            <td class="${snap.netWorth >= 0 ? 'green-text' : 'red-text'}"><strong>R$ ${snap.netWorth.toFixed(2)}</strong></td>
            <td class="red-text">R$ ${snap.debt.toFixed(2)}</td>
            <td>R$ ${snap.balance.toFixed(2)}</td>
          `;
          tableBody.appendChild(row);
        });
      }
      break;
    }
  }
}

// Renderizar lista de opções de Lazer (🎡)
function renderLeisureActivities(p) {
  const container = document.getElementById('leisure-activities-list');
  container.innerHTML = '';

  LEISURE_OPTIONS.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'chore-item-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.padding = '1.2rem';

    card.innerHTML = `
      <div class="chore-meta">
        <span style="font-size:2.5rem; display:block; margin-bottom: 5px;">${opt.emoji}</span>
        <h4 style="font-size:1.1rem;">${opt.name}</h4>
        <p style="font-size:0.8rem; color:var(--text-muted); margin: 6px 0;">${opt.description}</p>
        <div class="chore-impacts-list" style="margin-top: 5px;">
          <span class="warning-text" style="color:var(--warning); display:block; font-size:0.75rem;">😊 Felicidade: +${opt.happiness}%</span>
          <span style="display:block; color:var(--text-muted); font-size:0.75rem;">Energia necessária: <strong>${opt.energy}%</strong></span>
        </div>
      </div>
      <div class="price-action" style="margin-top: 15px;">
        <span class="price" style="font-size:1.1rem; display:block; margin-bottom:5px;">Custo: R$ ${opt.cost}</span>
        <button class="btn-primary btn-small btn-full btn-buy-leisure" data-id="${opt.id}">Comprar Lazer</button>
      </div>
    `;
    container.appendChild(card);
  });

  // Vincular clique do lazer
  document.querySelectorAll('.btn-buy-leisure').forEach(btn => {
    btn.addEventListener('click', async () => {
      const optionId = btn.getAttribute('data-id');
      const pId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const res = await engine.executeLeisure(pId, optionId);
      alert(res.message);
      if (res.success) {
        await refreshParticipantView();
        renderLeisureActivities(p);
      }
    });
  });
}

// Renderizar lista de consertos de quebras ativas (🛠️)
function renderMaintenanceProblems(p) {
  const container = document.getElementById('maintenance-problems-list');
  container.innerHTML = '';

  const breakdowns = p.activeEvents.filter(e => e.isBreakdown);

  if (breakdowns.length === 0) {
    container.innerHTML = '<p class="success-text" style="text-align:center; padding: 2rem 0; width:100%;">✔️ Nenhum equipamento ou estrutura quebrada em sua residência! Tudo em ordem.</p>';
    return;
  }

  breakdowns.forEach(evt => {
    const card = document.createElement('div');
    card.className = 'approval-card';
    card.innerHTML = `
      <div class="approval-card-header">
        <span>Ocorrência: <strong>Mês ${evt.weekTriggered}</strong></span>
        <span class="badge-danger">Necessita Reparo</span>
      </div>
      <div class="approval-card-body">
        <h4>🚨 ${evt.name}</h4>
        <p style="font-size:0.85rem; color:var(--text-muted); margin: 5px 0;">${evt.description}</p>
        <p style="font-size:0.8rem; background:rgba(239, 68, 68, 0.05); padding:6px; border-radius:4px; margin-top:8px; border:1px solid rgba(239,68,68,0.1);">
          ⚠️ **Impacto Contínuo**: Deteriora a Limpeza em **-15%** e a Felicidade em **-10%** no fim de cada ciclo se continuar quebrado!
        </p>
      </div>
      <div class="approval-card-actions" style="justify-content: space-between; align-items:center;">
        <span class="price green-text" style="font-weight:bold; font-size:1.1rem;">Custo do Reparo: R$ ${evt.repairCost.toFixed(2)}</span>
        <button class="btn-primary btn-small btn-repair-breakdown" data-id="${evt.id}">🛠️ Pagar Conserto</button>
      </div>
    `;
    container.appendChild(card);
  });

  // Vincular clique de reparo
  document.querySelectorAll('.btn-repair-breakdown').forEach(btn => {
    btn.addEventListener('click', async () => {
      const eventId = btn.getAttribute('data-id');
      const pId = engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
      const res = await engine.repairBreakdown(pId, eventId);
      alert(res.message);
      if (res.success) {
        await refreshParticipantView();
        
        // Recarregar os dados localmente
        const updatedParticipant = await engine.getParticipantById(pId);
        renderMaintenanceProblems(updatedParticipant);
      }
    });
  });
}

// --- PLANTA DA CASA VISUAL & QUADRO DA FAMÍLIA (🎨 NOVO) ---
function updateVisualHouseAndFamily(p) {
  // 1. Atualizar Checklist de Rotina Diária
  const checklistContainer = document.getElementById('daily-checklist-container');
  if (checklistContainer) {
    checklistContainer.innerHTML = '';
    
    const tasks = [
      {
        name: 'Limpeza Geral da Casa',
        icon: '🧹',
        completed: p.tasksCompletedToday.includes('clean_house'),
        freq: 'Semanal (Recomendado)'
      },
      {
        name: 'Lavar a Louça Acumulada',
        icon: '🍽️',
        completed: p.tasksCompletedToday.includes('wash_dishes'),
        freq: 'Diária (Obrigatória)'
      },
      {
        name: 'Cozinhar / Alimentação',
        icon: '🍳',
        completed: p.ateToday || p.tasksCompletedToday.some(t => t.startsWith('prepare_meals')),
        freq: 'Diária (Obrigatória)'
      }
    ];

    tasks.forEach(t => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '8px 12px';
      item.style.borderRadius = '8px';
      item.style.background = t.completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.05)';
      item.style.border = t.completed ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.1)';
      
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${t.icon}</span>
          <div>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-light); text-decoration:${t.completed ? 'line-through' : 'none'};">${t.name}</span>
            <span style="display:block; font-size:0.65rem; color:var(--text-muted);">${t.freq}</span>
          </div>
        </div>
        <span style="font-size:0.8rem; font-weight:700; color:${t.completed ? 'var(--success)' : 'var(--danger)'};">
          ${t.completed ? '✔️ Concluído' : '⏳ Pendente'}
        </span>
      `;
      checklistContainer.appendChild(item);
    });
  }

  // 2. Atualizar Quadro da Família (Membros & Expressões)
  const familyContainer = document.getElementById('family-members-container');
  if (familyContainer && p.family && p.family.members) {
    familyContainer.innerHTML = '';

    const isSick = p.activeIllnesses.length > 0;
    const isHungry = !p.ateToday && !p.tasksCompletedToday.some(t => t.startsWith('prepare_meals'));
    const isTired = p.energy < 30;
    const isSad = p.indicators.happiness < 40;
    const isStressed = p.indicators.happiness < 20;

    p.family.members.forEach(member => {
      let face = '😊';
      let statusText = 'Saudável e Feliz';
      let statusColor = 'var(--success)';
      let cardBg = 'rgba(34, 197, 94, 0.05)';
      let borderCol = 'rgba(34, 197, 94, 0.2)';

      if (isSick) {
        face = '🤒';
        const illnessNames = p.activeIllnesses.map(i => i.name).join(', ');
        statusText = `Doente: ${illnessNames}`;
        statusColor = 'var(--danger)';
        cardBg = 'rgba(239, 68, 68, 0.08)';
        borderCol = 'rgba(239, 68, 68, 0.3)';
      } else if (isHungry) {
        face = '🤢';
        statusText = 'Com Fome / Sem comer';
        statusColor = 'var(--warning)';
        cardBg = 'rgba(249, 115, 22, 0.08)';
        borderCol = 'rgba(249, 115, 22, 0.3)';
      } else if (isTired) {
        face = '🥱';
        statusText = 'Muito Cansado';
        statusColor = '#a855f7';
        cardBg = 'rgba(168, 85, 247, 0.08)';
        borderCol = 'rgba(168, 85, 247, 0.3)';
      } else if (isStressed) {
        face = '😡';
        statusText = 'Extremamente Estressado';
        statusColor = 'var(--danger)';
        cardBg = 'rgba(239, 68, 68, 0.08)';
        borderCol = 'rgba(239, 68, 68, 0.3)';
      } else if (isSad) {
        face = '😞';
        statusText = 'Triste / Desanimado';
        statusColor = 'var(--info)';
        cardBg = 'rgba(59, 130, 246, 0.08)';
        borderCol = 'rgba(59, 130, 246, 0.3)';
      }

      const card = document.createElement('div');
      card.className = 'family-member-card glass-panel';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.gap = '12px';
      card.style.padding = '10px 12px';
      card.style.borderRadius = '10px';
      card.style.background = cardBg;
      card.style.border = `1px solid ${borderCol}`;
      card.style.transition = 'transform 0.2s';
      
      card.innerHTML = `
        <div class="avatar-wrapper" style="font-size:2.2rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.15)); display:flex; align-items:center; justify-content:center; width:45px; height:45px; background:rgba(255,255,255,0.05); border-radius:50%; border:1px solid rgba(255,255,255,0.1);">
          ${face}
        </div>
        <div style="flex-grow:1;">
          <h4 style="margin:0; font-size:0.9rem; color:var(--text-light);">${member.name} (${member.relation === 'self' ? 'Você' : 'Cônjuge'})</h4>
          <span style="font-size:0.7rem; color:var(--text-muted); display:block;">Idade: ${member.age} anos</span>
          <span style="font-size:0.75rem; font-weight:600; color:${statusColor}; display:block; margin-top:2px;">${statusText}</span>
        </div>
      `;
      familyContainer.appendChild(card);
    });
  }

  // 3. Atualizar Planta da Casa Visual (Todos os Cômodos & Limpeza)
  const cleanVal = p.indicators.cleanliness || 0;
  const cleanlinessIndicator = document.getElementById('room-cleanliness-indicator');
  const houseRooms = ['room-card-hall', 'room-card-chores', 'room-card-kitchen', 'room-card-leisure', 'room-card-bills', 'room-card-maintenance'];

  if (cleanlinessIndicator) {
    if (cleanVal >= 80) {
      cleanlinessIndicator.innerHTML = '<span style="color:var(--success);">✨ Limpeza: ' + cleanVal + '%</span>';
    } else if (cleanVal >= 50) {
      cleanlinessIndicator.innerHTML = '<span style="color:var(--info);">👍 Limpeza: ' + cleanVal + '%</span>';
    } else if (cleanVal >= 30) {
      cleanlinessIndicator.innerHTML = '<span style="color:var(--warning);">💨 Limpeza: ' + cleanVal + '%</span>';
    } else {
      cleanlinessIndicator.innerHTML = '<span style="color:var(--danger); font-weight:bold; animation: blink-text 1.2s infinite;">🪰 Limpeza: ' + cleanVal + '%</span>';
    }
  }

  houseRooms.forEach(roomId => {
    const room = document.getElementById(roomId);
    if (room) {
      room.classList.remove('room-clean-sparkle', 'room-dirty-dust', 'room-dirty-chaotic');
      
      if (cleanVal >= 80) {
        room.classList.add('room-clean-sparkle');
        room.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.12)';
      } else if (cleanVal >= 50) {
        room.style.boxShadow = 'none';
      } else if (cleanVal >= 30) {
        room.classList.add('room-dirty-dust');
        room.style.boxShadow = 'none';
      } else {
        room.classList.add('room-dirty-chaotic');
        room.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.2)';
      }
    }
  });

  // 4. Detalhes de Consertos da Casa & Alertas Específicos nos Cômodos
  const roomMaintenance = document.getElementById('room-card-maintenance');
  const roomKitchen = document.getElementById('room-card-kitchen');
  const roomBathroom = document.getElementById('room-card-chores');
  
  const hasLeak = p.activeEvents.some(e => e.id === 'pipe_leak');
  const hasFridge = p.activeEvents.some(e => e.id === 'fridge_repair');

  // Limpar alertas específicos antigos
  const existingAlertLeak = document.getElementById('alert-leak');
  if (existingAlertLeak) existingAlertLeak.remove();
  const existingAlertFridge = document.getElementById('alert-fridge');
  if (existingAlertFridge) existingAlertFridge.remove();

  if (roomBathroom) {
    roomBathroom.style.border = '';
    if (hasLeak) {
      roomBathroom.style.border = '2px solid var(--danger)';
      const badge = document.createElement('div');
      badge.id = 'alert-leak';
      badge.className = 'room-alert-badge';
      badge.style.cssText = 'background:var(--danger); color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px; margin-top:5px; font-weight:bold; animation: pulse-red 1.2s infinite;';
      badge.textContent = '💧 Vazamento Ativo!';
      roomBathroom.appendChild(badge);
    }
  }

  if (roomKitchen) {
    roomKitchen.style.border = '';
    if (hasFridge) {
      roomKitchen.style.border = '2px solid var(--danger)';
      const badge = document.createElement('div');
      badge.id = 'alert-fridge';
      badge.className = 'room-alert-badge';
      badge.style.cssText = 'background:var(--danger); color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px; margin-top:5px; font-weight:bold; animation: pulse-red 1.2s infinite;';
      badge.textContent = '🔌 Geladeira Queimada!';
      roomKitchen.appendChild(badge);
    }
  }

  if (roomMaintenance) {
    roomMaintenance.classList.remove('maintenance-alert-active');
    
    if (hasLeak || hasFridge) {
      roomMaintenance.classList.add('maintenance-alert-active');
      roomMaintenance.style.border = '2px solid var(--danger)';
      
      let warnings = [];
      if (hasLeak) warnings.push('💧 Vazamento de Água');
      if (hasFridge) warnings.push('🔌 Geladeira Queimada');
      
      const descEl = roomMaintenance.querySelector('p');
      if (descEl) {
        descEl.innerHTML = `<strong class="red-text" style="animation: blink-text 1.2s infinite; display:block;">⚠️ REPAROS URGENTES:</strong><span style="font-size:0.7rem; color:var(--text-light);">${warnings.join('<br>')}</span>`;
      }
    } else {
      roomMaintenance.style.border = 'none';
      const descEl = roomMaintenance.querySelector('p');
      if (descEl) {
        descEl.textContent = 'Consertar vazamentos ou quebras de aparelhos domésticos.';
      }
    }
  }

  // 5. Exibir estoques de suprimentos no card do Supermercado
  const roomMarket = document.getElementById('room-card-market');
  const foodIndicator = document.getElementById('room-food-indicator');
  if (roomMarket && foodIndicator) {
    const basic = p.foodStockBasic || 0;
    const healthy = p.foodStockHealthy !== undefined ? p.foodStockHealthy : 5;
    const premium = p.foodStockPremium || 0;
    foodIndicator.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:5px; flex-wrap:wrap;">
        <span>Basic: <strong>${basic}</strong></span>
        <span>Saudável: <strong>${healthy}</strong></span>
        <span>Premium: <strong>${premium}</strong></span>
      </div>
    `;
  }
}
