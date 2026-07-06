/**
 * Missão Família - Adaptador de Banco de Dados Local (db.json)
 * Persistência local em arquivo para desenvolvimento e testes rápidos offline
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

import { 
  DEFAULT_CAMPAIGN_GOALS, 
  PRECONFIGURED_FAMILIES 
} from '../mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, '..', 'db.json');

// Estrutura em memória e persistência
class LocalDbAdapter {
  constructor() {
    this.cache = null;
  }

  async load() {
    if (this.cache) return this.cache;

    try {
      const data = await fs.readFile(dbFilePath, 'utf-8');
      this.cache = JSON.parse(data);
      return this.cache;
    } catch (err) {
      // Se arquivo não existe, criar estrutura padrão
      console.log("Arquivo db.json local não encontrado. Inicializando base local padrão...");
      this.cache = await this.seedDefaultData();
      await this.save();
      return this.cache;
    }
  }

  async save() {
    if (!this.cache) return;
    await fs.writeFile(dbFilePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  async seedDefaultData() {
    const adminPassHash = await bcrypt.hash('admin', 10);
    const passHash123 = await bcrypt.hash('123', 10);

    const initialDb = {
      users: [
        { id: 'admin_1', email: 'admin@gmail.com', username: 'admin', password_hash: adminPassHash, role: 'admin', name: 'Diretor Wilson Aires' },
        { id: 'user_wilson', email: 'wilson@gmail.com', username: 'wilson', password_hash: passHash123, role: 'participant', name: 'Wilson Aires', clube: 'Clube Pioneiros', unidade: 'Águia', age: 14 },
        { id: 'user_lucas', email: 'lucas@gmail.com', username: 'lucas', password_hash: passHash123, role: 'participant', name: 'Lucas Oliveira', clube: 'Clube Pioneiros', unidade: 'Falcão', age: 13 },
        { id: 'user_melissa', email: 'melissa@gmail.com', username: 'melissa', password_hash: passHash123, role: 'participant', name: 'Melissa Costa', clube: 'Clube Pioneiros', unidade: 'Rosa de Saron', age: 15 }
      ],
      campaigns: [
        {
          id: 'camp_2026',
          name: "Especialidade Orçamento 2026",
          difficulty: "medio",
          durationWeeks: 12,
          familyTypeId: "padrao",
          salaryType: "fixed",
          fixedSalary: 2500,
          minSalary: 2000,
          maxSalary: 3000,
          expensesPercentages: { alimentacao: 25, moradia: 25, transporte: 10, saude: 10, higiene: 5, educacao: 10, lazer: 10 },
          accountsConfig: [
            { id: 'agua', name: 'Conta de Água', enabled: true, minVal: 50, maxVal: 90 },
            { id: 'luz', name: 'Conta de Luz', enabled: true, minVal: 120, maxVal: 200 },
            { id: 'internet', name: 'Internet Banda Larga', enabled: true, minVal: 90, maxVal: 110 },
            { id: 'gas', name: 'Gás de Cozinha', enabled: true, minVal: 110, maxVal: 130 },
            { id: 'aluguel', name: 'Aluguel Residencial', enabled: true, minVal: 700, maxVal: 800 }
          ],
          lateFee: 2.0,
          interestRate: 1.0,
          cutoffDays: { luz: 15, internet: 10, agua: 20 },
          loanConfig: { minRate: 3, maxRate: 8, minTerm: 3, maxTerm: 12, minVal: 200, maxVal: 4000, requireApproval: true },
          investmentsEnabled: ['poupanca', 'cdb', 'tesouro_direto', 'fundo_acoes'],
          weights: { health: 30, happiness: 30, finance: 25, cleanliness: 15 },
          rankingEnabled: 1,
          goals: DEFAULT_CAMPAIGN_GOALS,
          active: 1
        }
      ],
      participants: [
        {
          id: 'part_wilson', userId: 'user_wilson', campaignId: 'camp_2026', week: 1, finished: 0, balance: 3300, reserve: 200, salary: 2500,
          family: PRECONFIGURED_FAMILIES.find(f => f.id === 'padrao'), loans: [], pendingLoans: [],
          investments: { poupanca: 100, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
          indicators: { health: 80, happiness: 85, cleanliness: 75, financial: 65 }, energy: 100,
          activeIllnesses: [], activeEvents: [], unpaidBills: [], overdueBills: [],
          tasksCompletedThisWeek: [], extraIncomeCompletedThisWeek: [], customExtraIncomePending: [], goalsStatus: {},
          boughtFoodThisMonth: false, cleaningProductsStock: 5,
          notifications: [{ type: 'info', text: 'Bem-vindo ao simulador Missão Família! Seu saldo inicial inclui o salário cheio.' }]
        },
        {
          id: 'part_lucas', userId: 'user_lucas', campaignId: 'camp_2026', week: 1, finished: 0, balance: 3000, reserve: 50, salary: 2400,
          family: PRECONFIGURED_FAMILIES.find(f => f.id === 'padrao'),
          loans: [{ id: 'loan_init', amount: 800, rate: 4, term: 6, paidTerms: 1, totalAmount: 992, monthlyPayment: 165.33, justification: "Móveis iniciais" }],
          pendingLoans: [], investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
          indicators: { health: 70, happiness: 65, cleanliness: 60, financial: 45 }, energy: 80,
          activeIllnesses: [], activeEvents: [], unpaidBills: [],
          overdueBills: [{ id: 'bill_luz_old', name: 'Conta de Luz Atrasada', value: 180, originalValue: 180, dueWeek: 0, fineApplied: 3.6, interestApplied: 1.8, totalValue: 185.4 }],
          tasksCompletedThisWeek: [], extraIncomeCompletedThisWeek: [], customExtraIncomePending: [], goalsStatus: {},
          boughtFoodThisMonth: false, cleaningProductsStock: 5,
          notifications: [{ type: 'warning', text: 'Cuidado! Você começou com uma conta de luz atrasada e um empréstimo.' }]
        },
        {
          id: 'part_melissa', userId: 'user_melissa', campaignId: 'camp_2026', week: 1, finished: 0, balance: 3900, reserve: 400, salary: 2800,
          family: PRECONFIGURED_FAMILIES.find(f => f.id === 'pequena'), loans: [], pendingLoans: [],
          investments: { poupanca: 300, cdb: 200, tesouro_direto: 0, fundo_acoes: 0 },
          indicators: { health: 90, happiness: 90, cleanliness: 90, financial: 80 }, energy: 100,
          activeIllnesses: [], activeEvents: [], unpaidBills: [], overdueBills: [],
          tasksCompletedThisWeek: [], extraIncomeCompletedThisWeek: [], customExtraIncomePending: [], goalsStatus: {},
          boughtFoodThisMonth: false, cleaningProductsStock: 5,
          notifications: [{ type: 'success', text: 'Excelente início! Suas economias e investimentos estão saudáveis.' }]
        }
      ],
      history: [
        { id: 'snap_part_wilson_1', participantId: 'part_wilson', week: 1, balance: 800, reserve: 200, investments: { poupanca: 100, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 }, indicators: { health: 80, happiness: 85, cleanliness: 75, financial: 65 }, debt: 0, netWorth: 1100 },
        { id: 'snap_part_lucas_1', participantId: 'part_lucas', week: 1, balance: 600, reserve: 50, investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 }, indicators: { health: 70, happiness: 65, cleanliness: 60, financial: 45 }, debt: 1000, netWorth: -350 },
        { id: 'snap_part_melissa_1', participantId: 'part_melissa', week: 1, balance: 1100, reserve: 400, investments: { poupanca: 300, cdb: 200, tesouro_direto: 0, fundo_acoes: 0 }, indicators: { health: 90, happiness: 90, cleanliness: 90, financial: 80 }, debt: 0, netWorth: 1800 }
      ],
      audit_logs: [
        { id: 'log_init', timestamp: new Date().toISOString(), username: 'Sistema', action: 'Banco Local Semeado', details: 'Fichas de demonstração populadas localmente no JSON.' }
      ]
    };

    // Gerar as faturas iniciais para os participantes padrão
    initialDb.participants.forEach(p => {
      const family = p.family;
      const campaign = initialDb.campaigns[0];
      const sizeMult = family.baseExpensesMultiplier;

      // Gerar utilidades do admin
      campaign.accountsConfig.forEach(cfg => {
        if (cfg.enabled) {
          const val = cfg.minVal + Math.random() * (cfg.maxVal - cfg.minVal);
          p.unpaidBills.push({
            id: 'bill_' + cfg.id + '_1_' + Math.random().toString(36).substr(2, 4),
            type: cfg.id, name: cfg.name, value: Math.round(val * sizeMult), dueWeek: 1
          });
        }
      });

      // Gerar percentuais do salário (removidos alimentação e moradia)
      const categories = [
        { id: 'transporte', name: 'Combustível/Transporte Público', perc: campaign.expensesPercentages.transporte },
        { id: 'saude', name: 'Plano de Saúde / Higiene Familiar', perc: campaign.expensesPercentages.saude }
      ];

      categories.forEach(cat => {
        if (cat.perc > 0) {
          let val = (p.salary * (cat.perc / 100)) * (0.9 + Math.random() * 0.2);
          p.unpaidBills.push({
            id: 'bill_' + cat.id + '_1_' + Math.random().toString(36).substr(2, 4),
            type: cat.id, name: cat.name, value: Math.round(val * sizeMult), dueWeek: 1
          });
        }
      });
    });

    return initialDb;
  }

  // --- API DO ADAPTADOR ---

  async getUser(usernameOrEmail) {
    const data = await this.load();
    const identifier = usernameOrEmail.toLowerCase();
    return data.users.find(u => 
      (u.email && u.email.toLowerCase() === identifier) || 
      (u.username && u.username.toLowerCase() === identifier)
    ) || null;
  }

  async getUserById(id) {
    const data = await this.load();
    return data.users.find(u => u.id === id) || null;
  }

  async createUser(user) {
    const data = await this.load();
    data.users.push(user);
    await this.save();
    return user;
  }

  async getActiveCampaign() {
    const data = await this.load();
    return data.campaigns.find(c => c.active === 1) || null;
  }

  async updateCampaign(campaign) {
    const data = await this.load();
    const idx = data.campaigns.findIndex(c => c.id === campaign.id);
    if (idx !== -1) {
      data.campaigns[idx] = campaign;
      await this.save();
    }
    return campaign;
  }

  async getParticipants() {
    const data = await this.load();
    return data.participants;
  }

  async getParticipantById(id) {
    const data = await this.load();
    return data.participants.find(p => p.id === id) || null;
  }

  async getParticipantByUserId(userId) {
    const data = await this.load();
    return data.participants.find(p => p.userId === userId) || null;
  }

  async createParticipant(participant) {
    const data = await this.load();
    data.participants.push(participant);
    await this.save();
    return participant;
  }

  async saveParticipant(participant) {
    const data = await this.load();
    const idx = data.participants.findIndex(p => p.id === participant.id);
    if (idx !== -1) {
      data.participants[idx] = participant;
      await this.save();
    }
    return participant;
  }

  async addHistorySnapshot(snap) {
    const data = await this.load();
    // Excluir duplicados se houver
    data.history = data.history.filter(h => h.id !== snap.id);
    data.history.push(snap);
    await this.save();
    return snap;
  }

  async getHistory(participantId) {
    const data = await this.load();
    return data.history.filter(h => h.participantId === participantId);
  }

  async addAuditLog(log) {
    const data = await this.load();
    data.audit_logs.unshift(log);
    if (data.audit_logs.length > 100) data.audit_logs.pop();
    await this.save();
    return log;
  }

  async getAuditLogs() {
    const data = await this.load();
    return data.audit_logs;
  }
}

export const localAdapter = new LocalDbAdapter();
