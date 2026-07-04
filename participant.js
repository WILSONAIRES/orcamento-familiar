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

  // --- BOTÃO DE AVANÇO MENSAL (FECHAMENTO) ---
  const btnAdvance = document.getElementById('btn-advance-month');
  if (btnAdvance) {
    btnAdvance.addEventListener('click', async () => {
      const currentId = engine.state.activeParticipantId;
      if (confirm("Tem certeza que deseja fechar as contas deste mês? O sistema processará salários, contas atrasadas, parcelas de empréstimos e investimentos.")) {
        const res = await engine.advanceParticipantWeek(currentId);
        alert(res.message);
        
        // Atualizar views
        await refreshParticipantView();
        if (activeOpenModalId) {
          await renderModalContent(activeOpenModalId);
        }
      }
    });
  }

  // --- FORMULÁRIO DE EMPRÉSTIMO ---
  const formLoan = document.getElementById('form-request-loan');
  if (formLoan) {
    formLoan.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentId = engine.state.activeParticipantId;
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
      const currentId = engine.state.activeParticipantId;
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
      const currentId = engine.state.activeParticipantId;
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
      const currentId = engine.state.activeParticipantId;
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
      const currentId = engine.state.activeParticipantId;
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
      const currentId = engine.state.activeParticipantId;
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
  const pId = engine.state.activeParticipantId;
  if (!pId) return;

  try {
    const p = await engine.getParticipantById(pId);
    if (!p) return;

    // Header dados
    document.getElementById('player-family-name').textContent = `Família de ${p.name}`;
    document.getElementById('player-family-desc').textContent = `${p.family.name} (${p.clube} / ${p.unidade})`;
    document.getElementById('player-calendar-week').textContent = `📅 Mês ${p.week} / 12`;

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
  } catch (err) {
    console.error("Erro ao recarregar a visualização do participante:", err);
  }
}

// Renderizar o conteúdo do modal aberto
async function renderModalContent(modalId) {
  const pId = engine.state.activeParticipantId;
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

      // Eventos
      p.activeEvents.forEach(evt => {
        alertsFound = true;
        const alertCard = document.createElement('div');
        alertCard.className = 'alert-item-card warning';
        alertCard.innerHTML = `
          <div>
            <h5>⚠️ Evento Ocorrido: ${evt.name}</h5>
            <p>${evt.description} Impacto financeiro: R$ ${evt.impact}.</p>
            <p class="alert-tip">💡 Conselho: ${evt.tip}</p>
          </div>
        `;
        alertContainer.appendChild(alertCard);
      });

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
        narratorText.textContent = "Seu caixa está quase zerado e você não tem reserva! Experimente fazer renda extra (vender doces ou passear com cães) no módulo de Trabalho.";
      } else if (p.overdueBills.length > 0) {
        narratorTitle.textContent = "🚨 Alerta de Contas:";
        narratorText.textContent = "Você tem faturas em atraso correndo juros e multa. Pague-as o quanto antes no menu 'Contas a Pagar' para recuperar a felicidade.";
      } else {
        narratorTitle.textContent = "🧓 Conselheiro Familiar:";
        narratorText.textContent = "Excelente administração até o momento! Continue realizando tarefas físicas para manter a saúde e poupe parte do salário na reserva.";
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
        const card = document.createElement('div');
        card.className = 'income-item-card';
        
        let impactsText = [];
        if (act.healthImpact) impactsText.push(`Saúde (${act.healthImpact >= 0 ? '+' : ''}${act.healthImpact}%)`);
        if (act.happinessImpact) impactsText.push(`Felicidade (${act.happinessImpact >= 0 ? '+' : ''}${act.happinessImpact}%)`);
        if (act.cleanlinessImpact) impactsText.push(`Limpeza (${act.cleanlinessImpact >= 0 ? '+' : ''}${act.cleanlinessImpact}%)`);

        card.innerHTML = `
          <div class="income-card-meta">
            <h4>${act.name}</h4>
            <p>${act.description}</p>
            <p style="font-size:0.75rem;">Tempo necessário: <strong>${act.daysRequired} dia(s)</strong> | Consumo de Energia: <strong>${act.daysRequired * 15}%</strong></p>
            <span class="impacts ${act.happinessImpact >= 0 ? 'green-text' : 'red-text'}">${impactsText.join(', ')}</span>
          </div>
          <div class="income-card-action">
            <span class="reward">R$ ${reward}</span>
            <button class="btn-primary btn-small btn-do-income" data-id="${act.id}">Realizar Trabalho</button>
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
          const pId = btn.getAttribute('data-id');
          const type = btn.getAttribute('data-type');
          
          currentInvProductAction = pId;
          currentInvActionType = type;
          
          const prod = DEFAULT_INVESTMENT_PRODUCTS.find(x => x.id === pId);
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
      
      const diff = INITIAL_DIFFICULTIES[campaign.difficulty];

      DEFAULT_TASKS.forEach(task => {
        const finalCost = Math.round(task.cost * diff.costMultiplier);
        const card = document.createElement('div');
        card.className = 'chore-item-card';

        let impactsHtml = [];
        if (task.cleanlinessImpact) impactsHtml.push(`<span class="blue-text">🧹 Limpeza: +${task.cleanlinessImpact}%</span>`);
        if (task.healthImpact) impactsHtml.push(`<span class="red-text">❤️ Saúde: +${task.healthImpact}%</span>`);
        if (task.happinessImpact) impactsHtml.push(`<span class="warning-text" style="color:var(--warning);">😊 Felicidade: +${task.happinessImpact}%</span>`);

        card.innerHTML = `
          <div class="chore-meta">
            <h4>${task.name}</h4>
            <p>${task.description}</p>
            <div class="chore-impacts-list" style="margin-top: 10px;">
              ${impactsHtml.join('')}
              <span style="display:block; color:var(--text-muted); font-size:0.75rem;">Energia necessária: <strong>${task.energyCost}%</strong></span>
            </div>
          </div>
          <div class="price-action" style="margin-top: 15px;">
            <span class="price" style="font-size:1.1rem;">Custo: R$ ${finalCost}</span>
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
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state-text" style="text-align:center;">Ainda não há histórico consolidado. Complete o primeiro mês!</td></tr>';
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
