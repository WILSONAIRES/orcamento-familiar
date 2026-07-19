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
    this.activeCampaignId = 'camp_2026';
    this.supabaseClient = null;
  }

  // Inicializa o Supabase no browser se as credenciais estiverem disponíveis na API
  async initializeSupabase() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      if (config.supabaseUrl && config.supabaseAnonKey) {
        if (window.supabase) {
          this.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
          
          // Capturar sessão automática (ex: após redirecionamento do Google OAuth)
          const { data: { session } } = await this.supabaseClient.auth.getSession();
          if (session) {
            this.token = session.access_token;
            localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
            
            // Buscar perfil
            const profileRes = await this.getProfile();
            if (profileRes.success && profileRes.user) {
              this.currentUser = profileRes.user;
              this.activeParticipantId = profileRes.user.participantId;
              localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
              if (this.activeParticipantId) {
                localStorage.setItem(STORAGE_KEY_ACTIVE_PART, this.activeParticipantId);
              }
            } else if (profileRes.isNewUser) {
              this.currentUser = { email: profileRes.email, isNewUser: true };
              localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
            }
          }
          return true;
        }
      }
    } catch (err) {
      console.warn("Falha ao inicializar o Supabase no navegador:", err);
    }
    return false;
  }

  // --- CONTROLE DE AUTENTICAÇÃO ---

  isAuthenticated() {
    return this.token !== null;
  }

  async login(username, password) {
    try {
      // Se o Supabase estiver ativo no browser
      if (this.supabaseClient) {
        const { data, error } = await this.supabaseClient.auth.signInWithPassword({
          email: username,
          password: password
        });

        if (error) {
          return { success: false, message: error.message };
        }

        this.token = data.session.access_token;
        localStorage.setItem(STORAGE_KEY_TOKEN, this.token);

        const profileRes = await this.getProfile();
        if (profileRes.success && profileRes.user) {
          this.currentUser = profileRes.user;
          this.activeParticipantId = profileRes.user.participantId;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
          if (this.activeParticipantId) {
            localStorage.setItem(STORAGE_KEY_ACTIVE_PART, this.activeParticipantId);
          } else {
            localStorage.removeItem(STORAGE_KEY_ACTIVE_PART);
          }
          return { success: true, user: this.currentUser };
        } else if (profileRes.isNewUser) {
          this.currentUser = { email: profileRes.email, isNewUser: true };
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
          return { success: true, user: this.currentUser, isNewUser: true };
        } else {
          return { success: false, message: profileRes.message || 'Erro ao obter dados de perfil.' };
        }
      }

      // Modo local offline (JSON)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const resData = await response.json();
      if (!response.ok) {
        return { success: false, message: resData.message || 'Erro ao realizar login.' };
      }

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
      if (this.supabaseClient) {
        const { data, error } = await this.supabaseClient.auth.signUp({
          email: username,
          password: password
        });

        if (error) {
          return { success: false, message: error.message };
        }

        // Se a sessão iniciou imediatamente após o cadastro
        if (data.session) {
          this.token = data.session.access_token;
          localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
          
          // Cria o perfil público na nossa tabela
          const createProfileRes = await this.completeProfile(name, clube, unidade, age);
          return createProfileRes;
        } else {
          // Se requer validação por e-mail no Supabase
          return { success: true, message: 'Cadastro efetuado! Verifique seu e-mail para confirmar a conta antes de logar.' };
        }
      }

      // Modo local offline
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

  async loginWithGoogle() {
    if (!this.supabaseClient) return { success: false, message: 'Supabase offline.' };
    const { error } = await this.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async getProfile() {
    try {
      const res = await this.apiCall('/api/auth/me');
      return { success: true, user: res.user, isNewUser: res.isNewUser, email: res.email };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async completeProfile(name, clube, unidade, age) {
    try {
      const res = await this.apiCall('/api/auth/complete-profile', 'POST', { name, clube, unidade, age });
      if (res.success) {
        // Recarregar perfil completo
        const me = await this.getProfile();
        if (me.success) {
          this.currentUser = me.user;
          this.activeParticipantId = me.user.participantId;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
          if (this.activeParticipantId) {
            localStorage.setItem(STORAGE_KEY_ACTIVE_PART, this.activeParticipantId);
          }
        }
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async logout() {
    try {
      if (this.supabaseClient) {
        await this.supabaseClient.auth.signOut();
      }
    } catch (e) {}

    this.token = null;
    this.currentUser = null;
    this.activeParticipantId = null;

    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PART);

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
      if (response.status === 401 || (response.status === 403 && !url.includes('/api/auth/me') && !url.includes('/complete-profile'))) {
        console.warn("Sessão inválida ou expirada. Deslogando...");
        this.logout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const resData = await response.json();
      if (!response.ok) {
        // Se for status 403 e tiver pendência de onboarding
        if (resData.isNewUser) {
          return resData;
        }
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

  async deleteParticipant(id) {
    try {
      const res = await this.apiCall(`/api/participant/${id}`, 'DELETE');
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
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

  async nextDay(participantId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/next-day`, 'POST');
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
    // Redireciona para o endpoint de ciclo se o front tentar avançar diretamente
    return await this.advanceCycleAdmin(participantId);
  }

  async executeLeisure(participantId, optionId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/execute-leisure`, 'POST', { optionId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async repairBreakdown(participantId, eventId) {
    try {
      const res = await this.apiCall(`/api/participant/${participantId}/repair-breakdown`, 'POST', { eventId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // --- AÇÕES DO ADMINISTRADOR ---

  async advanceCycleAdmin(participantId) {
    try {
      const res = await this.apiCall('/api/admin/advance-cycle', 'POST', { participantId });
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async advanceAllCyclesAdmin() {
    try {
      const res = await this.apiCall('/api/admin/advance-all-cycles', 'POST');
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

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
