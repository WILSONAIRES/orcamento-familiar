/**
 * Missão Família - Simulador de Orçamento Familiar
 * Cliente de Estado Assíncrono (Comunicação com API Express + SQLite)
 */

const STORAGE_KEY_TOKEN = 'mf_jwt_token';
const STORAGE_KEY_USER = 'mf_user_data';
const STORAGE_KEY_ACTIVE_PART = 'mf_active_part_id';

class SimulationEngine {
  constructor() {
    this.token = localStorage.getItem(STORAGE_KEY_TOKEN) || null;
    this.currentUser = JSON.parse(localStorage.getItem(STORAGE_KEY_USER)) || null;
    this.activeParticipantId = localStorage.getItem(STORAGE_KEY_ACTIVE_PART) || null;
    this.activeCampaignId = 'camp_2026'; // Identificador padrão da campanha
  }

  // --- CONTROLE DE AUTENTICAÇÃO ---

  isAuthenticated() {
    return this.token !== null;
  }

  async login(username, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const resData = await response.json();
      if (!response.ok) {
        return { success: false, message: resData.message || 'Erro ao realizar login.' };
      }

      // Guardar sessão
      this.token = resData.token;
      this.currentUser = resData.user;
      this.activeParticipantId = resData.user.participantId;

      localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
      if (this.activeParticipantId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PART, this.activeParticipantId);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_PART);
      }

      return { success: true, user: this.currentUser };
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Não foi possível conectar ao servidor.' };
    }
  }

  async register(username, password, role, name, clube, unidade, age, adminCode) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, name, clube, unidade, age, adminCode })
      });

      const resData = await response.json();
      if (!response.ok) {
        return { success: false, message: resData.message || 'Erro ao realizar cadastro.' };
      }
      return { success: true, message: resData.message };
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Falha na conexão com o servidor.' };
    }
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    this.activeParticipantId = null;

    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PART);

    // Recarregar SPA para tela de login
    window.location.reload();
  }

  // --- REQUISIÇÃO AUXILIAR CENTRALIZADA (COM CABEÇALHOS JWT) ---

  async apiCall(url, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const options = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      // Tratar sessão expirada ou não autorizada
      if (response.status === 401 || response.status === 403) {
        console.warn("Sessão inválida ou expirada. Deslogando...");
        this.logout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Erro na requisição da API.');
      }
      return resData;
    } catch (err) {
      console.error(`Erro na chamada API (${method} ${url}):`, err);
      throw err;
    }
  }

  // --- CONFIGURAÇÃO DA CAMPANHA ---

  async getActiveCampaign() {
    return await this.apiCall('/api/campaign');
  }

  async updateCampaignSettings(newSettings) {
    try {
      const res = await this.apiCall('/api/campaign', 'PUT', newSettings);
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // --- GESTÃO DE PARTICIPANTES ---

  async getParticipants() {
    return await this.apiCall('/api/participants');
  }

  async getParticipantById(id) {
    return await this.apiCall(`/api/participant/${id}`);
  }

  async registerParticipant(name, clube, unidade, age) {
    // Para simplificar a experiência, o admin pode registrar participantes novos 
    // direto pelo painel de admin. Mas no novo sistema, os alunos criam a conta na tela de registro.
    // Para manter retrocompatibilidade com o botão "Cadastrar Aluno" no admin, vamos gerar um user com senha padrão '123'
    const username = name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 100);
    try {
      const res = await this.register(username, '123', 'participant', name, clube, unidade, age, null);
      if (res.success) {
        // Retorna um objeto simulando a criação rápida
        return { id: 'temp', name };
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  // --- AÇÕES DO PARTICIPANTE (CASA VIRTUAL) ---

  async payBill(participantId, billId, isOverdue = false) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/pay-bill`, 'POST', { billId, isOverdue });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async executeTask(participantId, taskId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/execute-task`, 'POST', { taskId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async requestLoan(participantId, amount, term, justification) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/request-loan`, 'POST', { amount, term, justification });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async investMoney(participantId, productId, amount) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/invest`, 'POST', { productId, amount });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async withdrawInvestment(participantId, productId, amount) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/withdraw-investment`, 'POST', { productId, amount });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async manageReserve(participantId, action, amount) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/manage-reserve`, 'POST', { action, amount });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async performExtraIncome(participantId, activityId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/extra-income`, 'POST', { activityId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async submitCustomExtraIncome(participantId, name, description, estimatedReward) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/custom-income`, 'POST', { name, description, estimatedReward });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async buyMarketFood(participantId, option) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/market-food`, 'POST', { option });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async buyMedicine(participantId, diseaseId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/buy-medicine`, 'POST', { diseaseId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async advanceParticipantWeek(participantId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/advance-week`, 'POST');
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // --- AÇÕES DO ADMINISTRADOR ---

  async processLoanRequest(participantId, loanId, action, modifiedParams = null) {
    try {
      const res = await this.apiCall('/api/admin/approve-loan', 'POST', { participantId, loanId, action, modifiedParams });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async processCustomIncomeRequest(participantId, activityId, action) {
    try {
      const res = await this.apiCall('/api/admin/approve-income', 'POST', { participantId, activityId, action });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async getAuditLogs() {
    return await this.apiCall('/api/admin/audit-logs');
  }

  // --- LÓGICA DE CÁLCULO DE PONTUAÇÃO CLIENT-SIDE (Sincrona) ---

  calculateFinalScore(participant, campaign) {
    const w = campaign.weights;
    const ind = participant.indicators;

    const baseScore = (ind.health * (w.health / 100)) +
                      (ind.happiness * (w.happiness / 100)) +
                      (ind.financial * (w.finance / 100)) +
                      (ind.cleanliness * (w.cleanliness / 100));

    let bonus = 0;
    campaign.goals.forEach(goal => {
      if (participant.goalsStatus && participant.goalsStatus[goal.id] === "completed") {
        bonus += goal.points;
      }
    });

    return Math.round(baseScore * 10) + bonus;
  }
}

export const engine = new SimulationEngine();
