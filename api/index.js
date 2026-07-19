/**
 * Missão Família - API Serverless Express (Refinada com Novas Regras)
 * Roteador central compatível com Vercel Serverless Functions
 */

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

import { db } from './db.js';
import { 
  INITIAL_DIFFICULTIES, 
  DEFAULT_EXTRA_INCOME_ACTIVITIES, 
  DEFAULT_DISEASES, 
  DEFAULT_EVENTS, 
  DEFAULT_TASKS, 
  DEFAULT_INVESTMENT_PRODUCTS, 
  PRECONFIGURED_FAMILIES,
  DEFAULT_CAMPAIGN_GOALS 
} from '../mockData.js';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;
const SECRET_KEY = process.env.JWT_SECRET || 'missao_familia_secret_key_desbravadores';
const ADMIN_SECURITY_CODE = 'DESBRAVADORES';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

app.use(cors());
app.use(express.json());

// --- AUTO-AVANÇO DE CICLO AUTOMÁTICO COM BASE NO DIA DA SEMANA ---
async function checkAndAdvanceCyclesAutomatically() {
  try {
    const campaign = await db.getActiveCampaign();
    if (!campaign || !campaign.cycleTransitionDay) return;

    const daysMap = {
      'domingo': 0, 'segunda': 1, 'terca': 2, 'terça': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6, 'sábado': 6
    };

    const targetDay = daysMap[campaign.cycleTransitionDay.toLowerCase()];
    if (targetDay === undefined) return;

    const now = new Date();
    const currentDay = now.getDay(); // 0-6 (0=Domingo, 1=Segunda, etc.)

    if (currentDay === targetDay) {
      const todayStr = now.toISOString().split('T')[0]; // AAAA-MM-DD
      if (campaign.lastCycleAdvanceDate !== todayStr) {
        console.log(`⏰ [AutoCycle] Hoje é ${campaign.cycleTransitionDay}. Rodando avanço de ciclo automático...`);
        
        const list = await db.getParticipants();
        const activeOnes = list.filter(p => p.finished === 0);

        for (const p of activeOnes) {
          try {
            await advanceParticipantWeekLogic(p.id, 'Avanço Automático (Sistema)');
          } catch (e) {
            console.error(`Erro ao avançar participante ${p.id} automaticamente:`, e);
          }
        }

        campaign.lastCycleAdvanceDate = todayStr;
        await db.updateCampaign(campaign);

        console.log(`⏰ [AutoCycle] Avanço de ciclo automático concluído!`);
      }
    }
  } catch (err) {
    console.error('Erro no AutoCycle:', err);
  }
}

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    checkAndAdvanceCyclesAutomatically().catch(console.error);
  }
  next();
});

// --- TABELAS DE LAZER (CONFIGURAÇÃO) ---
const LEISURE_OPTIONS = {
  streaming: { id: 'streaming', name: 'Assistir Filme em Casa (Streaming)', cost: 15, happiness: 5, energy: 5 },
  park: { id: 'park', name: 'Passeio no Parque / Piquenique', cost: 40, happiness: 10, energy: 10 },
  cinema: { id: 'cinema', name: 'Cinema & Lanche em Família', cost: 120, happiness: 22, energy: 15 },
  trip: { id: 'trip', name: 'Viagem de Fim de Semana / Recreação', cost: 500, happiness: 50, energy: 25 }
};

// --- MIDDLEWARE DE AUTENTICAÇÃO JWT ---
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token de autenticação não fornecido.' });

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      // Modo offline (Local JSON)
      jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Sessão expirada ou token inválido.' });
        req.user = decoded;
        next();
      });
      return;
    }

    // Modo Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(403).json({ message: 'Sessão expirada ou token inválido no Supabase.' });
    }

    const profile = await db.getUser(user.email);
    if (!profile) {
      // Novo usuário via Google/OAuth com perfil público pendente de preenchimento
      req.user = { id: user.id, username: user.email, email: user.email, isNewUser: true };
      
      const allowedPaths = ['/api/auth/me', '/api/auth/complete-profile'];
      if (allowedPaths.includes(req.path)) {
        return next();
      }
      return res.status(403).json({ isNewUser: true, message: 'Cadastro de perfil pendente. Complete seu registro.' });
    }

    req.user = {
      id: profile.id,
      username: profile.email,
      email: profile.email,
      role: profile.role,
      name: profile.name,
      participantId: null
    };

    if (profile.role === 'participant') {
      const part = await db.getParticipantByUserId(profile.id);
      if (part) {
        req.user.participantId = part.id;
      }
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: 'Sessão inválida.' });
  }
}

// Middleware de validação do Admin
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Restrito a administradores.' });
  }
  next();
}

// --- ROTAS DA API DE AUTENTICAÇÃO ---

// Fornece a configuração do Supabase para o cliente browser
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || null,
    supabaseAnonKey: SUPABASE_ANON_KEY || null
  });
});

// Retorna as informações do usuário atual baseado no JWT fornecido
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  if (req.user.isNewUser) {
    return res.json({ isNewUser: true, email: req.user.email });
  }
  try {
    const user = await db.getUser(req.user.email);
    if (!user) return res.status(404).json({ message: 'Perfil não encontrado.' });
    res.json({
      user: {
        id: user.id,
        username: user.email,
        email: user.email,
        role: user.role,
        name: user.name,
        participantId: req.user.participantId
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao obter dados de login.' });
  }
});

// Finaliza o cadastro de perfil para quem fez login com o Google/OAuth
app.post('/api/auth/complete-profile', authenticateToken, async (req, res) => {
  if (!req.user.isNewUser) {
    return res.status(400).json({ message: 'Perfil já configurado.' });
  }
  const { name, clube, unidade, age } = req.body;
  
  // Forçar admin se for waisilva@gmail.com
  let role = 'participant';
  if (req.user.email.toLowerCase() === 'waisilva@gmail.com') {
    role = 'admin';
  }

  try {
    const isWai = req.user.email.toLowerCase() === 'waisilva@gmail.com';

    // Gerar faturas e casa virtual inicial para participantes (e admin Wai Silva que joga)
    const activeCampaign = await db.getActiveCampaign();
    if (!activeCampaign) {
      return res.status(500).json({ message: 'A campanha ativa não está semeada no banco de dados. Configure a campanha no banco primeiro.' });
    }

    const existingUser = await db.getUser(req.user.email);
    if (existingUser) {
      return res.status(400).json({ message: 'Perfil já existe no banco de dados.' });
    }

    const newUser = {
      id: req.user.id,
      email: req.user.email,
      password_hash: null,
      role,
      name,
      clube: (role === 'admin' && !isWai) ? null : (clube || null),
      unidade: (role === 'admin' && !isWai) ? null : (unidade || null),
      age: (role === 'admin' && !isWai) ? null : (age ? parseInt(age) : null)
    };

    await db.createUser(newUser);

    // Se for admin e NÃO for waisilva@gmail.com, finaliza aqui (não cria participante/casa virtual)
    if (role === 'admin' && !isWai) {
      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: name,
        action: 'Novo Diretor Cadastrado (Google)',
        details: `Administrador ${name} criado via Google OAuth.`
      });
      return res.json({ success: true, message: 'Perfil de Administrador criado com sucesso!', role: 'admin' });
    }

    const diff = INITIAL_DIFFICULTIES[activeCampaign.difficulty];
    const familyTemplate = PRECONFIGURED_FAMILIES.find(f => f.id === activeCampaign.familyTypeId) || PRECONFIGURED_FAMILIES[1];

    const baseSalary = activeCampaign.salaryType === 'fixed' 
      ? activeCampaign.fixedSalary 
      : Math.floor(activeCampaign.minSalary + Math.random() * (activeCampaign.maxSalary - activeCampaign.minSalary));

    const finalSalary = Math.round(baseSalary * diff.incomeMultiplier);
    // Saldo inicial + Salário cheio disponível no início da simulação
    const finalBalance = Math.round(diff.startingBalance * diff.incomeMultiplier) + finalSalary;

    const participantId = 'part_' + Date.now();
    const bills = [];
    const sizeMult = familyTemplate.baseExpensesMultiplier;
    
    activeCampaign.accountsConfig.forEach(cfg => {
      if (cfg.enabled) {
        const val = cfg.minVal + Math.random() * (cfg.maxVal - cfg.minVal);
        bills.push({
          id: 'bill_' + cfg.id + '_1_' + Math.random().toString(36).substr(2, 4),
          type: cfg.id, name: cfg.name, value: Math.round(val * sizeMult * diff.costMultiplier), dueWeek: 1
        });
      }
    });

    const categories = [
      { id: 'transporte', name: 'Combustível/Transporte Público', perc: activeCampaign.expensesPercentages.transporte },
      { id: 'saude', name: 'Plano de Saúde / Higiene Familiar', perc: activeCampaign.expensesPercentages.saude },
      { id: 'higiene', name: 'Produtos de Limpeza e Higiene', perc: activeCampaign.expensesPercentages.higiene },
      { id: 'educacao', name: 'Mensalidades / Material Escolar', perc: activeCampaign.expensesPercentages.educacao }
    ];

    categories.forEach(cat => {
      if (cat.perc > 0) {
        let val = (finalSalary * (cat.perc / 100)) * (0.9 + Math.random() * 0.2);
        bills.push({
          id: 'bill_' + cat.id + '_1_' + Math.random().toString(36).substr(2, 4),
          type: cat.id, name: cat.name, value: Math.round(val * sizeMult * diff.costMultiplier), dueWeek: 1
        });
      }
    });

    const newParticipant = {
      id: participantId,
      userId: req.user.id,
      campaignId: activeCampaign.id,
      week: 1, finished: 0, balance: finalBalance, reserve: 0.0, salary: finalSalary,
      family: familyTemplate, loans: [], pendingLoans: [],
      investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
      indicators: { health: 75, happiness: 75, cleanliness: 75, financial: 50 },
      energy: 100, activeIllnesses: [], activeEvents: [],
      unpaidBills: bills, overdueBills: [],
      tasksCompletedThisWeek: [], extraIncomeCompletedThisWeek: [], customExtraIncomePending: [],
      goalsStatus: {}, boughtFoodThisMonth: false,
      cleaningProductsStock: 5, // Inicia com 5 cargas de produtos de limpeza
      notifications: [{ type: 'info', text: 'Você ativou sua conta com o Google! Seu saldo inicial conta com o salário cheio do mês.' }]
    };

    await db.createParticipant(newParticipant);

    await db.addHistorySnapshot({
      id: 'snap_' + participantId + '_1',
      participantId, week: 1, balance: finalBalance, reserve: 0,
      investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
      indicators: { health: 75, happiness: 75, cleanliness: 75, financial: 50 },
      debt: 0, netWorth: finalBalance
    });

    await db.addAuditLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      username: name,
      action: 'Novo Cadastro de Aluno (Google)',
      details: `Participante ${name} (Unidade: ${unidade}) criado via Google.`
    });

    res.json({ success: true, message: 'Perfil criado!', participantId, role: 'participant' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao finalizar o cadastro de perfil.' });
  }
});

// Registro (Cadastro) de Usuários
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role, name, clube, unidade, age, adminCode } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    // Validação de Admin (Ignorada para o e-mail waisilva@gmail.com)
    let finalRole = role;
    if (username.toLowerCase() === 'waisilva@gmail.com') {
      finalRole = 'admin';
    } else if (role === 'admin') {
      if (adminCode !== ADMIN_SECURITY_CODE) {
        return res.status(400).json({ message: 'Código de acesso do clube inválido para criação de Administrador.' });
      }
    }

    // Verificar se usuário existe no banco
    const existingUser = await db.getUser(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Nome de usuário já está em uso.' });
    }

    const userId = 'user_' + Date.now();
    const passwordHash = await bcrypt.hash(password, 10);

    const isWai = username.toLowerCase() === 'waisilva@gmail.com';

    const newUser = {
      id: userId,
      email: username.toLowerCase(),
      password_hash: passwordHash,
      role: finalRole,
      name,
      clube: (finalRole === 'admin' && !isWai) ? null : (clube || null),
      unidade: (finalRole === 'admin' && !isWai) ? null : (unidade || null),
      age: (finalRole === 'admin' && !isWai) ? null : (age ? parseInt(age) : null)
    };

    // Salvar Usuário no Banco
    await db.createUser(newUser);

    // Se for admin e NÃO for waisilva@gmail.com, não cria registro do participante
    if (finalRole === 'admin' && !isWai) {
      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: name,
        action: 'Novo Diretor Cadastrado',
        details: `Administrador ${name} criado via cadastro direto.`
      });
      return res.status(201).json({ success: true, message: 'Administrador cadastrado com sucesso!' });
    }

    // Se for Participante ou se for waisilva@gmail.com, criar registro do jogo
    if (finalRole === 'participant' || isWai) {
      const activeCampaign = await db.getActiveCampaign();
      if (!activeCampaign) {
        return res.status(500).json({ message: 'Não há nenhuma campanha ativa configurada no momento. Solicite ao Diretor.' });
      }

      const diff = INITIAL_DIFFICULTIES[activeCampaign.difficulty];
      const familyTemplate = PRECONFIGURED_FAMILIES.find(f => f.id === activeCampaign.familyTypeId) || PRECONFIGURED_FAMILIES[1];

      const baseSalary = activeCampaign.salaryType === 'fixed' 
        ? activeCampaign.fixedSalary 
        : Math.floor(activeCampaign.minSalary + Math.random() * (activeCampaign.maxSalary - activeCampaign.minSalary));

      const finalSalary = Math.round(baseSalary * diff.incomeMultiplier);
      // Saldo inicial + Salário cheio disponível no início da simulação
      const finalBalance = Math.round(diff.startingBalance * diff.incomeMultiplier) + finalSalary;

      const participantId = 'part_' + Date.now();

      // Gerar faturas do primeiro mês
      const bills = [];
      const sizeMult = familyTemplate.baseExpensesMultiplier;
      
      activeCampaign.accountsConfig.forEach(cfg => {
        if (cfg.enabled) {
          const val = cfg.minVal + Math.random() * (cfg.maxVal - cfg.minVal);
          bills.push({
            id: 'bill_' + cfg.id + '_1_' + Math.random().toString(36).substr(2, 4),
            type: cfg.id,
            name: cfg.name,
            value: Math.round(val * sizeMult * diff.costMultiplier),
            dueWeek: 1
          });
        }
      });

      // Faturas de percentuais do salário (removidos alimentação, moradia e lazer das contas fixas)
      const categories = [
        { id: 'transporte', name: 'Combustível/Transporte Público', perc: activeCampaign.expensesPercentages.transporte },
        { id: 'saude', name: 'Plano de Saúde / Higiene Familiar', perc: activeCampaign.expensesPercentages.saude },
        { id: 'higiene', name: 'Produtos de Limpeza e Higiene', perc: activeCampaign.expensesPercentages.higiene },
        { id: 'educacao', name: 'Mensalidades / Material Escolar', perc: activeCampaign.expensesPercentages.educacao }
      ];

      categories.forEach(cat => {
        if (cat.perc > 0) {
          let val = (finalSalary * (cat.perc / 100)) * (0.9 + Math.random() * 0.2);
          bills.push({
            id: 'bill_' + cat.id + '_1_' + Math.random().toString(36).substr(2, 4),
            type: cat.id,
            name: cat.name,
            value: Math.round(val * sizeMult * diff.costMultiplier),
            dueWeek: 1
          });
        }
      });

      const newParticipant = {
        id: participantId,
        userId: userId,
        campaignId: activeCampaign.id,
        week: 1,
        finished: 0,
        balance: finalBalance,
        reserve: 0.0,
        salary: finalSalary,
        family: familyTemplate,
        loans: [],
        pendingLoans: [],
        investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
        indicators: { health: 75, happiness: 75, cleanliness: 75, financial: 50 },
        energy: 100,
        activeIllnesses: [],
        activeEvents: [],
        unpaidBills: bills,
        overdueBills: [],
        tasksCompletedThisWeek: [],
        extraIncomeCompletedThisWeek: [],
        customExtraIncomePending: [],
        goalsStatus: {},
        boughtFoodThisMonth: false, // Inicia sem comprar comida
        cleaningProductsStock: 5, // Começa com 5 cargas de material de limpeza
        notifications: [{ type: 'info', text: 'Você iniciou a simulação! Seu saldo inicial conta com o salário cheio do mês.' }]
      };

      // Inserir Participante
      await db.createParticipant(newParticipant);

      // Salvar snapshot inicial
      await db.addHistorySnapshot({
        id: 'snap_' + participantId + '_1',
        participantId,
        week: 1,
        balance: finalBalance,
        reserve: 0,
        investments: { poupanca: 0, cdb: 0, tesouro_direto: 0, fundo_acoes: 0 },
        indicators: { health: 75, happiness: 75, cleanliness: 75, financial: 50 },
        debt: 0,
        netWorth: finalBalance
      });

      // Log de auditoria
      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: name,
        action: 'Novo Cadastro de Aluno',
        details: `Participante ${name} (Unidade: ${unidade}) criado com sucesso.`
      });
    }

    res.status(201).json({ success: true, message: 'Usuário cadastrado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Erro no servidor durante o registro.' });
  }
});

// Login de Usuários
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Preencha usuário e senha.' });
  }

  try {
    const user = await db.getUser(username);
    if (!user) {
      return res.status(400).json({ message: 'Usuário ou senha incorretos.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ message: 'Usuário ou senha incorretos.' });
    }

    // Gerar Token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    // Buscar ID do participante se for jogador
    let participantId = null;
    if (user.role === 'participant') {
      const part = await db.getParticipantByUserId(user.id);
      if (part) participantId = part.id;
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        participantId
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno ao realizar login.' });
  }
});

// --- ROTAS DA API GERAL (PROTEGIDAS) ---

// Retorna Campanha Ativa
app.get('/api/campaign', authenticateToken, async (req, res) => {
  try {
    const campaign = await db.getActiveCampaign();
    if (!campaign) return res.status(404).json({ message: 'Nenhuma campanha ativa configurada.' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar campanha.' });
  }
});

// Atualizar Campanha (Admin Only)
app.put('/api/campaign', authenticateToken, requireAdmin, async (req, res) => {
  const { name, difficulty, durationWeeks, fixedSalary, cycleTransitionDay, lateFee, interestRate, loanConfig, weights } = req.body;

  try {
    const campaign = await db.getActiveCampaign();
    if (!campaign) return res.status(404).json({ message: 'Nenhuma campanha ativa encontrada.' });

    const updated = {
      ...campaign,
      name,
      difficulty,
      durationWeeks,
      fixedSalary,
      cycleTransitionDay: cycleTransitionDay || 'Domingo',
      lateFee,
      interestRate,
      loanConfig,
      weights
    };

    await db.updateCampaign(updated);

    await db.addAuditLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      username: req.user.name,
      action: 'Configuração da Campanha Modificada',
      details: `Parâmetros editados. Nível de dificuldade ajustado para: ${difficulty}.`
    });

    res.json({ success: true, message: 'Configurações de campanha atualizadas!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar campanha.' });
  }
});

// Listar todos os participantes (Admin Only)
app.get('/api/participants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await db.getParticipants();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao listar participantes.' });
  }
});

// Obter dados de um participante específico
app.get('/api/participant/:id', authenticateToken, async (req, res) => {
  const pId = req.params.id;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    // Segurança: Admin pode ver tudo; Participante comum apenas a si mesmo
    if (req.user.role !== 'admin' && p.userId !== req.user.id) {
      return res.status(403).json({ message: 'Acesso não autorizado a esta família.' });
    }

    // Virar o dia automaticamente se o dia real calendário mudou (virada às 00h)
    const checkAndAdvanceDaysAutomatically = async (part) => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // AAAA-MM-DD
        
        part.day = part.day || 1;
        part.lastDayTransitionDate = part.lastDayTransitionDate || todayStr;
        part.tasksCompletedToday = part.tasksCompletedToday || [];
        part.ateToday = part.ateToday || false;

        if (part.lastDayTransitionDate !== todayStr) {
          if (part.day < 30) {
            console.log(`⏰ [AutoDay] Virando dia automático para ${part.id}. De ${part.day} para ${part.day + 1}`);
            let logs = [];
            
            // 1. Limpeza (clean_house)
            const cleanedToday = part.tasksCompletedToday.includes('clean_house');
            if (!cleanedToday) {
              part.indicators.cleanliness = Math.max(0, part.indicators.cleanliness - 15);
              part.indicators.health = Math.max(0, part.indicators.health - 3);
              part.indicators.happiness = Math.max(0, part.indicators.happiness - 3);
              logs.push('A casa não foi limpa hoje (Limpeza: -15%, Saúde: -3%, Felicidade: -3%)');
            }

            // 2. Pratos (wash_dishes)
            const washedToday = part.tasksCompletedToday.includes('wash_dishes');
            if (!washedToday) {
              part.indicators.cleanliness = Math.max(0, part.indicators.cleanliness - 10);
              part.indicators.health = Math.max(0, part.indicators.health - 2);
              part.indicators.happiness = Math.max(0, part.indicators.happiness - 2);
              logs.push('A louça não foi lavada hoje (Limpeza: -10%, Saúde: -2%, Felicidade: -2%)');
            }

            // 3. Alimentação
            const preparedToday = part.tasksCompletedToday.includes('prepare_meals');
            const hasAte = part.ateToday || preparedToday;

            if (!hasAte) {
              part.indicators.health = 10;
              part.indicators.happiness = 10;
              logs.push('⚠️ A família ficou com FOME hoje! Saúde e Felicidade desceram para o nível mais baixo (10%)!');
            }

            // 4. Consequências de Limpeza Baixa (Quebras Estruturais - Probabilidade Dinâmica)
            const cleanVal = part.indicators.cleanliness || 0;
            const breakdownChance = 0.05 + 0.90 * (1.0 - (cleanVal / 100.0));
            if (Math.random() < breakdownChance) {
              const breakdownTemplates = [
                { id: 'pipe_leak', name: 'Vazamento no Banheiro', repairCost: 300, description: 'Um cano estourou na parede do banheiro, molhando a casa e exigindo encanador de emergência.' },
                { id: 'fridge_repair', name: 'Geladeira Queimou', repairCost: 450, description: 'A geladeira parou de funcionar e os alimentos correm risco de estragar. Conserto imediato necessário.' }
              ];
              const choice = breakdownTemplates[Math.floor(Math.random() * breakdownTemplates.length)];
              if (!part.activeEvents.some(e => e.id === choice.id)) {
                part.activeEvents.push({
                  id: choice.id,
                  name: choice.name,
                  description: choice.description,
                  impact: 0,
                  tip: 'Problemas na estrutura da casa reduzem a limpeza e o bem-estar da família. Resolva-os o quanto antes!',
                  weekTriggered: part.week,
                  isBreakdown: true,
                  repairCost: choice.repairCost
                });
                part.indicators.cleanliness = Math.max(0, part.indicators.cleanliness - 10);
                part.indicators.happiness = Math.max(0, part.indicators.happiness - 5);
                logs.push(`🔧 Ocorreu um '${choice.name}' (Chance: ${Math.round(breakdownChance*100)}%)! Chame manutenção.`);
              }
            }

            // 5. Consequências de Saúde/Felicidade Baixa (Doenças - Probabilidade Dinâmica)
            const healthVal = part.indicators.health || 0;
            const happyVal = part.indicators.happiness || 0;
            const avgHealthHappy = (healthVal + happyVal) / 2.0;
            const diseaseChance = 0.05 + 0.90 * (1.0 - (avgHealthHappy / 100.0));
            if (Math.random() < diseaseChance) {
              const diseaseTemplates = [
                { id: 'gripe', name: 'Gripe Comum', description: 'Febre baixa, coriza e dor no corpo. Exige repouso e antitérmico.', requiredMedicine: 'Antitérmico e Vitamina C', medicineCost: 45, recoveryWeeks: 1, healthImpact: -15, happinessImpact: -10 },
                { id: 'infeccao_intestinal', name: 'Infecção Intestinal', description: 'Causada por alimentação inadequada ou falta de higiene na cozinha.', requiredMedicine: 'Antibiótico e Soro de Reidratação', medicineCost: 80, recoveryWeeks: 1, healthImpact: -25, happinessImpact: -15 },
                { id: 'estresse_extremo', name: 'Cansaço Extremo / Estresse', description: 'Esgotamento físico e mental devido a excesso de preocupação financeira.', requiredMedicine: 'Polivitamínico e Lazer', medicineCost: 60, recoveryWeeks: 2, healthImpact: -20, happinessImpact: -25 },
                { id: 'alergia_pele', name: 'Alergia de Pele', description: 'Reação alérgica causada por poeira ou acúmulo de sujeira na residência.', requiredMedicine: 'Pomada Antialérgica', medicineCost: 35, recoveryWeeks: 1, healthImpact: -10, happinessImpact: -8 }
              ];
              const choice = diseaseTemplates[Math.floor(Math.random() * diseaseTemplates.length)];
              if (!part.activeIllnesses.some(i => i.id === choice.id)) {
                part.activeIllnesses.push({ ...choice });
                part.indicators.health = Math.max(0, part.indicators.health + choice.healthImpact);
                part.indicators.happiness = Math.max(0, part.indicators.happiness + choice.happinessImpact);
                logs.push(`🤒 Um membro da família contraiu '${choice.name}' (Chance: ${Math.round(diseaseChance*100)}%)! Vá à Farmácia.`);
              }
            }

            part.day += 1;
            part.tasksCompletedToday = [];
            part.ateToday = false;
            part.energy = 100;

            const msgStr = logs.length > 0 
              ? `Dia ${part.day - 1} finalizado. Ocorrências: ${logs.join('; ')}`
              : `Dia ${part.day - 1} finalizado com sucesso! Toda a rotina diária foi cumprida. Energia restaurada.`;
            
            part.notifications.unshift({ 
              type: logs.length > 0 ? 'warning' : 'success', 
              text: msgStr 
            });
          }
          
          part.lastDayTransitionDate = todayStr;
          await db.saveParticipant(part);
        }
      } catch (err) {
        console.error('Erro na transição de dia automática:', err);
      }
    };

    await checkAndAdvanceDaysAutomatically(p);

    const historySnaps = await db.getHistory(pId);
    p.history = historySnaps;

    res.json(p);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao carregar ficha do participante.' });
  }
});

// --- OPERAÇÕES DO JOGO ---

// Pagar Fatura
app.post('/api/participant/:id/pay-bill', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { billId, isOverdue } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    const billList = isOverdue ? p.overdueBills : p.unpaidBills;
    const billIdx = billList.findIndex(b => b.id === billId);

    if (billIdx === -1) return res.status(400).json({ message: 'Fatura não encontrada.' });

    const bill = billList[billIdx];
    const finalVal = isOverdue ? (bill.totalValue || bill.value) : bill.value;

    if (p.balance < finalVal) {
      const needed = finalVal - p.balance;
      if (p.reserve >= needed) {
        p.reserve -= needed;
        p.balance = 0;
        p.notifications.unshift({ type: 'info', text: `R$ ${needed} retirados da Reserva de Emergência para pagar '${bill.name}'.` });
      } else {
        return res.status(400).json({ message: 'Saldo e Reserva de Emergência insuficientes.' });
      }
    } else {
      p.balance -= finalVal;
    }

    billList.splice(billIdx, 1);
    p.notifications.unshift({ type: 'success', text: `Pago faturamento '${bill.name}' por R$ ${finalVal.toFixed(2)}.` });
    p.indicators.happiness = Math.min(100, p.indicators.happiness + 2);

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Fatura paga!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao liquidar conta.' });
  }
});

// Realizar Tarefas Domésticas (Limpeza)
app.post('/api/participant/:id/execute-task', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { taskId } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Erro ao carregar dados do participante.' });

    const task = DEFAULT_TASKS.find(t => t.id === taskId);
    if (!task) return res.status(400).json({ message: 'Tarefa inválida.' });

    if (p.energy < task.energyCost) {
      return res.status(400).json({ message: 'Você não tem energia suficiente para realizar esta tarefa.' });
    }

    // Verificar se possui produtos de limpeza em estoque (se a tarefa exigir)
    if (task.requiresCleaningProduct) {
      if (!p.cleaningProductsStock || p.cleaningProductsStock <= 0) {
        return res.status(400).json({ message: 'Você não tem produtos de limpeza em estoque! Compre um kit no Supermercado.' });
      }
      p.cleaningProductsStock -= 1;
    }

    // Debitar energia
    p.energy -= task.energyCost;
    
    // Novas regras: Aumenta saúde e limpeza, mas diminui um pouco a felicidade
    const happinessDecrease = 3; // Reduz em 3% flat
    p.indicators.cleanliness = Math.min(100, Math.max(0, p.indicators.cleanliness + task.cleanlinessImpact));
    p.indicators.health = Math.min(100, Math.max(0, p.indicators.health + task.healthImpact));
    p.indicators.happiness = Math.max(0, p.indicators.happiness - happinessDecrease);

    p.tasksCompletedThisWeek.push(taskId);
    p.tasksCompletedToday = p.tasksCompletedToday || [];
    if (!p.tasksCompletedToday.includes(taskId)) {
      p.tasksCompletedToday.push(taskId);
    }
    if (taskId.startsWith('prepare_meals')) {
      p.ateToday = true;
    }
    
    const cleaningUsageText = task.requiresCleaningProduct ? 'Gasta 1 carga de produtos de limpeza.' : 'Não consome material de limpeza.';
    p.notifications.unshift({ 
      type: 'info', 
      text: `Tarefa concluída: '${task.name}'. ${cleaningUsageText} Energia: -${task.energyCost}%. Felicidade: -${happinessDecrease}%.` 
    });

    await db.saveParticipant(p);
    res.json({ success: true, message: `Tarefa '${task.name}' realizada com sucesso!` });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao realizar tarefa.' });
  }
});

// Realizar Lazer Opcional
app.post('/api/participant/:id/execute-leisure', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { optionId } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    const opt = LEISURE_OPTIONS[optionId];
    if (!opt) return res.status(400).json({ message: 'Opção de lazer inválida.' });

    if (p.energy < opt.energy) {
      return res.status(400).json({ message: 'Energia física insuficiente para esta atividade de lazer.' });
    }
    if (p.balance < opt.cost) {
      return res.status(400).json({ message: 'Saldo financeiro insuficiente para esta atividade de lazer.' });
    }

    p.balance -= opt.cost;
    p.energy -= opt.energy;
    p.indicators.happiness = Math.min(100, p.indicators.happiness + opt.happiness);
    p.notifications.unshift({ 
      type: 'success', 
      text: `Lazer em família: '${opt.name}' concluído! Custo: R$ ${opt.cost}. Felicidade: +${opt.happiness}%.` 
    });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Atividade de lazer realizada!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao realizar lazer.' });
  }
});

// Consertar Quebra
app.post('/api/participant/:id/repair-breakdown', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { eventId } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    const evtIdx = p.activeEvents.findIndex(e => e.id === eventId && e.isBreakdown);
    if (evtIdx === -1) return res.status(400).json({ message: 'Evento de quebra não encontrado ou já consertado.' });

    const evt = p.activeEvents[evtIdx];
    if (p.balance < evt.repairCost) {
      return res.status(400).json({ message: `Saldo insuficiente para pagar o conserto (Custo: R$ ${evt.repairCost}).` });
    }

    p.balance -= evt.repairCost;
    p.activeEvents.splice(evtIdx, 1); // Remove o evento ativo de quebra
    p.notifications.unshift({ 
      type: 'success', 
      text: `Reparo realizado: '${evt.name}' consertado! Custou R$ ${evt.repairCost}.` 
    });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Equipamento consertado!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao consertar quebra.' });
  }
});

// Solicitar Empréstimo
app.post('/api/participant/:id/request-loan', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { amount, term, justification } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const campaign = await db.getActiveCampaign();
    if (!p || !campaign) return res.status(404).json({ message: 'Dados não encontrados.' });

    const loanCfg = campaign.loanConfig;

    if (amount < loanCfg.minVal || amount > loanCfg.maxVal) {
      return res.status(400).json({ message: `Montante deve estar entre R$ ${loanCfg.minVal} e R$ ${loanCfg.maxVal}.` });
    }
    if (term < loanCfg.minTerm || term > loanCfg.maxTerm) {
      return res.status(400).json({ message: `Prazo deve estar entre ${loanCfg.minTerm} e ${loanCfg.maxTerm} parcelas.` });
    }

    const estRate = (loanCfg.minRate + loanCfg.maxRate) / 2;
    const monthlyRate = estRate / 100;
    const pmt = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    
    // Limite de endividamento
    const currentActivePayments = p.loans.reduce((sum, l) => sum + l.monthlyPayment, 0);
    if (currentActivePayments + pmt > p.salary * 0.45) {
      return res.status(400).json({ message: `Empréstimo negado! Parcela de R$ ${pmt.toFixed(2)} excede o limite crítico de endividamento (45% do salário).` });
    }

    const newRequest = {
      id: 'loan_req_' + Date.now(),
      amount: Math.round(amount),
      term: parseInt(term),
      rate: Math.round(estRate * 10) / 10,
      monthlyPayment: Math.round(pmt * 100) / 100,
      totalAmount: Math.round(pmt * term * 100) / 100,
      justification,
      status: 'pending',
      date: new Date().toISOString()
    };

    p.pendingLoans.push(newRequest);
    p.notifications.unshift({ type: 'info', text: `Pedido de empréstimo de R$ ${amount} submetido à aprovação.` });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Pedido enviado ao Diretor!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao solicitar empréstimo.' });
  }
});

// Poupar
app.post('/api/participant/:id/invest', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { productId, amount } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    if (amount <= 0 || p.balance < amount) return res.status(400).json({ message: 'Saldo insuficiente.' });

    p.balance -= amount;
    p.investments[productId] = (p.investments[productId] || 0) + amount;
    p.notifications.unshift({ type: 'success', text: `Aplicado R$ ${amount.toFixed(2)} em ${productId.toUpperCase()}.` });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Aplicação realizada!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao aplicar.' });
  }
});

app.post('/api/participant/:id/withdraw-investment', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { productId, amount } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const invested = p.investments[productId] || 0;
    if (amount <= 0 || invested < amount) return res.status(400).json({ message: 'Saldo insuficiente.' });

    const prod = DEFAULT_INVESTMENT_PRODUCTS.find(x => x.id === productId);
    const penalty = prod && prod.withdrawalPenalty ? amount * prod.withdrawalPenalty : 0;
    const net = amount - penalty;

    p.investments[productId] -= amount;
    p.balance += net;
    
    let msg = `Resgate de R$ ${net.toFixed(2)} efetuado.`;
    if (penalty > 0) msg += ` Descontada taxa de resgate de R$ ${penalty.toFixed(2)}.`;
    
    p.notifications.unshift({ type: 'info', text: msg });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Resgate efetuado!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao resgatar.' });
  }
});

// Reserva
app.post('/api/participant/:id/manage-reserve', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { action, amount } = req.body;

  try {
    const p = await db.getParticipantById(pId);

    if (action === 'deposit') {
      if (amount <= 0 || p.balance < amount) return res.status(400).json({ message: 'Saldo insuficiente.' });
      p.balance -= amount;
      p.reserve += amount;
      p.notifications.unshift({ type: 'success', text: `R$ ${amount} guardados na Reserva de Emergência.` });
    } else if (action === 'withdraw') {
      if (amount <= 0 || p.reserve < amount) return res.status(400).json({ message: 'Reserva insuficiente.' });
      p.reserve -= amount;
      p.balance += amount;
      p.notifications.unshift({ type: 'info', text: `R$ ${amount} retirados da Reserva.` });
    }

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Reserva atualizada!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao gerenciar reserva.' });
  }
});

// Renda Extra
app.post('/api/participant/:id/extra-income', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { activityId } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const campaign = await db.getActiveCampaign();
    if (!p || !campaign) return res.status(404).json({ message: 'Dados não encontrados.' });

    // Cada tarefa de renda extra pode ser feita uma vez por ciclo (mês)
    if (p.extraIncomeCompletedThisWeek.includes(activityId)) {
      return res.status(400).json({ message: 'Esta atividade de renda extra já foi realizada este mês.' });
    }

    const act = DEFAULT_EXTRA_INCOME_ACTIVITIES.find(a => a.id === activityId);
    if (!act) return res.status(400).json({ message: 'Atividade de renda extra inválida.' });

    const diff = INITIAL_DIFFICULTIES[campaign.difficulty];
    
    // Custo de execução e probabilidade de sucesso
    const costToExec = Math.round((act.executionCost || 0) * diff.costMultiplier);
    const successChance = act.successProbability || 0.8;

    if (p.balance < costToExec) {
      return res.status(400).json({ message: `Saldo insuficiente para cobrir o custo de execução de R$ ${costToExec}.` });
    }

    const energyCost = act.daysRequired * 15;
    if (p.energy < energyCost) {
      return res.status(400).json({ message: 'Você não tem energia física suficiente para realizar este trabalho.' });
    }

    // Cobrar custo financeiro e energia física
    p.balance -= costToExec;
    p.energy -= energyCost;

    // Rolar probabilidade de retorno
    const isSuccess = Math.random() < successChance;
    let actualReward = 0;

    if (isSuccess) {
      // Retorno aleatório entre 50% e 120% do estimado (baseReward * diff.incomeMultiplier)
      const baseReward = Math.round(act.baseReward * diff.incomeMultiplier);
      const returnMult = 0.5 + Math.random() * 0.7; // [0.5, 1.2]
      actualReward = Math.round(baseReward * returnMult);
      p.balance += actualReward;

      // Aplicar impactos emocionais/sociais apenas se deu certo
      if (act.happinessImpact) p.indicators.happiness = Math.max(0, Math.min(100, p.indicators.happiness + act.happinessImpact));
      if (act.healthImpact) p.indicators.health = Math.max(0, Math.min(100, p.indicators.health + act.healthImpact));
      if (act.cleanlinessImpact) p.indicators.cleanliness = Math.max(0, Math.min(100, p.indicators.cleanliness + act.cleanlinessImpact));

      p.notifications.unshift({ 
        type: 'success', 
        text: `Renda Extra: '${act.name}' concluída com sucesso! Custo: R$ ${costToExec} | Retorno: R$ ${actualReward} (${(returnMult * 100).toFixed(0)}% do estimado).` 
      });
    } else {
      // Falhou (retorno zero)
      p.notifications.unshift({ 
        type: 'danger', 
        text: `Renda Extra: '${act.name}' falhou! Você investiu R$ ${costToExec} em materiais mas não obteve retorno financeiro.` 
      });
    }

    // Registrar execução para bloquear reuso no ciclo
    p.extraIncomeCompletedThisWeek.push(activityId);

    await db.saveParticipant(p);
    res.json({ 
      success: true, 
      message: isSuccess 
        ? `Trabalho realizado com sucesso! Retorno de R$ ${actualReward}.` 
        : `Trabalho realizado, mas infelizmente não deu retorno e você perdeu o custo de execução.` 
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro na renda extra.' });
  }
});

app.post('/api/participant/:id/custom-income', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { name, description, estimatedReward } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const newRequest = {
      id: 'custom_inc_' + Date.now(),
      name,
      description,
      estimatedReward: parseInt(estimatedReward),
      status: 'pending',
      date: new Date().toISOString()
    };

    p.customExtraIncomePending.push(newRequest);
    p.notifications.unshift({ type: 'info', text: `Proposta de renda extra '${name}' enviada para aprovação do Diretor.` });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Proposta enviada!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao propor renda extra.' });
  }
});

// Excluir Participante (Restrito a Admin)
app.delete('/api/participant/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Apenas o Diretor pode excluir alunos.' });
  }

  const pId = req.params.id;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) {
      return res.status(404).json({ message: 'Participante não encontrado.' });
    }

    // Excluir participante e histórico
    await db.deleteParticipant(pId);

    // Se houver userId correspondente, excluir login
    if (p.userId) {
      await db.deleteUser(p.userId);
    }

    await db.addAuditLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      username: req.user.email,
      action: 'Excluir Aluno',
      details: `Ficha de ${p.name} excluída permanentemente pelo administrador.`
    });

    res.json({ success: true, message: `Ficha do desbravador '${p.name}' excluída com sucesso.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir participante.' });
  }
});

// Comprar Comida
app.post('/api/participant/:id/market-food', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { option } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const campaign = await db.getActiveCampaign();

    const diff = INITIAL_DIFFICULTIES[campaign.difficulty];
    const sizeMult = p.family.baseExpensesMultiplier;

    // Se a opção for produtos de limpeza
    if (option === 'cleaning_products') {
      const cost = Math.round(50 * sizeMult * diff.costMultiplier);
      if (p.balance < cost) return res.status(400).json({ message: 'Saldo insuficiente para comprar o Kit de Limpeza.' });

      p.balance -= cost;
      p.cleaningProductsStock = (p.cleaningProductsStock || 0) + 5;
      p.notifications.unshift({ 
        type: 'success', 
        text: `Comprado Kit de Produtos de Limpeza por R$ ${cost}. +5 cargas adicionadas.` 
      });

      await db.saveParticipant(p);
      return res.json({ success: true, message: 'Kit de Produtos de Limpeza comprado!' });
    }

    let cost = 0, healthImpact = 0, happinessImpact = 0, name = "";

    if (option === 'basic') {
      name = "Alimentação Básica (Ultraprocessados)";
      cost = 150 * sizeMult * diff.costMultiplier; healthImpact = -10; happinessImpact = -3;
    } else if (option === 'healthy') {
      name = "Alimentação Equilibrada (Fresco)";
      cost = 300 * sizeMult * diff.costMultiplier; healthImpact = 8; happinessImpact = 5;
    } else if (option === 'premium') {
      name = "Alimentação Premium (Orgânico)";
      cost = 500 * sizeMult * diff.costMultiplier; healthImpact = 15; happinessImpact = 12;
    }

    cost = Math.round(cost);

    if (p.balance < cost) return res.status(400).json({ message: 'Saldo insuficiente.' });

    p.balance -= cost;
    p.indicators.health = Math.max(0, Math.min(100, p.indicators.health + healthImpact));
    p.indicators.happiness = Math.max(0, Math.min(100, p.indicators.happiness + happinessImpact));
    
    // Grava compra de comida
    p.boughtFoodThisMonth = true; 
    p.ateToday = true;
    p.notifications.unshift({ type: 'success', text: `Compra de alimentação '${name}' efetuada por R$ ${cost}. Família alimentada!` });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Comida comprada!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro no mercado.' });
  }
});

// Virar o Dia / Dormir (Recuperar Energia e Aplicar Regras Diárias)
app.post('/api/participant/:id/next-day', authenticateToken, async (req, res) => {
  const pId = req.params.id;

  try {
    const p = await db.getParticipantById(pId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    // Fallbacks para novos campos
    p.day = p.day || 1;
    p.tasksCompletedToday = p.tasksCompletedToday || [];
    p.ateToday = p.ateToday || false;
    p.cleaningProductsStock = p.cleaningProductsStock !== undefined ? p.cleaningProductsStock : 5;

    // Se o dia do participante for >= 30, ele não pode avançar o dia sozinho. Ele deve esperar a virada do mês pelo admin!
    if (p.day >= 30) {
      return res.status(400).json({ 
        message: 'Você atingiu o dia 30 do ciclo! Aguarde o Diretor fechar as contas e avançar o ciclo mensal da campanha para iniciar o próximo mês.' 
      });
    }

    let logs = [];
    
    // 1. Verificar Limpeza (Tarefa clean_house)
    const cleanedToday = p.tasksCompletedToday.includes('clean_house');
    if (!cleanedToday) {
      p.indicators.cleanliness = Math.max(0, p.indicators.cleanliness - 15);
      p.indicators.health = Math.max(0, p.indicators.health - 3);
      p.indicators.happiness = Math.max(0, p.indicators.happiness - 3);
      logs.push('A casa não foi limpa hoje (Limpeza: -15%, Saúde: -3%, Felicidade: -3%)');
    }

    // 2. Verificar Pratos (Tarefa wash_dishes)
    const washedToday = p.tasksCompletedToday.includes('wash_dishes');
    if (!washedToday) {
      p.indicators.cleanliness = Math.max(0, p.indicators.cleanliness - 10);
      p.indicators.health = Math.max(0, p.indicators.health - 2);
      p.indicators.happiness = Math.max(0, p.indicators.happiness - 2);
      logs.push('A louça não foi lavada hoje (Limpeza: -10%, Saúde: -2%, Felicidade: -2%)');
    }

    // 3. Verificar Alimentação (Tarefa prepare_meals ou comprado do supermercado hoje)
    const preparedToday = p.tasksCompletedToday.includes('prepare_meals');
    const hasAte = p.ateToday || preparedToday;

    if (!hasAte) {
      // "caso o usuário não faça nada de alimentação, saude e felicidade já vão para o nivel mais baixo"
      p.indicators.health = 10; // Nível mais baixo
      p.indicators.happiness = 10; // Nível mais baixo
      logs.push('⚠️ A família ficou com FOME hoje! Saúde e Felicidade despencaram para o nível mais baixo (10%)!');
    }

    // 4. Consequências de Limpeza Baixa (Quebras Estruturais - Probabilidade Dinâmica)
    const cleanVal = p.indicators.cleanliness || 0;
    const breakdownChance = 0.05 + 0.90 * (1.0 - (cleanVal / 100.0));
    if (Math.random() < breakdownChance) {
      const breakdownTemplates = [
        { id: 'pipe_leak', name: 'Vazamento no Banheiro', repairCost: 300, description: 'Um cano estourou na parede do banheiro, molhando a casa e exigindo encanador de emergência.' },
        { id: 'fridge_repair', name: 'Geladeira Queimou', repairCost: 450, description: 'A geladeira parou de funcionar e os alimentos correm risco de estragar. Conserto imediato necessário.' }
      ];
      const choice = breakdownTemplates[Math.floor(Math.random() * breakdownTemplates.length)];
      if (!p.activeEvents.some(e => e.id === choice.id)) {
        p.activeEvents.push({
          id: choice.id,
          name: choice.name,
          description: choice.description,
          impact: 0,
          tip: 'Problemas na estrutura da casa reduzem a limpeza e o bem-estar da família. Resolva-os o quanto antes!',
          weekTriggered: p.week,
          isBreakdown: true,
          repairCost: choice.repairCost
        });
        p.indicators.cleanliness = Math.max(0, p.indicators.cleanliness - 10);
        p.indicators.happiness = Math.max(0, p.indicators.happiness - 5);
        logs.push(`🔧 Ocorreu um '${choice.name}' (Chance: ${Math.round(breakdownChance*100)}%)! Chame manutenção.`);
      }
    }

    // 5. Consequências de Saúde/Felicidade Baixa (Doenças - Probabilidade Dinâmica)
    const healthVal = p.indicators.health || 0;
    const happyVal = p.indicators.happiness || 0;
    const avgHealthHappy = (healthVal + happyVal) / 2.0;
    const diseaseChance = 0.05 + 0.90 * (1.0 - (avgHealthHappy / 100.0));
    if (Math.random() < diseaseChance) {
      const diseaseTemplates = [
        { id: 'gripe', name: 'Gripe Comum', description: 'Febre baixa, coriza e dor no corpo. Exige repouso e antitérmico.', requiredMedicine: 'Antitérmico e Vitamina C', medicineCost: 45, recoveryWeeks: 1, healthImpact: -15, happinessImpact: -10 },
        { id: 'infeccao_intestinal', name: 'Infecção Intestinal', description: 'Causada por alimentação inadequada ou falta de higiene na cozinha.', requiredMedicine: 'Antibiótico e Soro de Reidratação', medicineCost: 80, recoveryWeeks: 1, healthImpact: -25, happinessImpact: -15 },
        { id: 'estresse_extremo', name: 'Cansaço Extremo / Estresse', description: 'Esgotamento físico e mental devido a excesso de preocupação financeira.', requiredMedicine: 'Polivitamínico e Lazer', medicineCost: 60, recoveryWeeks: 2, healthImpact: -20, happinessImpact: -25 },
        { id: 'alergia_pele', name: 'Alergia de Pele', description: 'Reação alérgica causada por poeira ou acúmulo de sujeira na residência.', requiredMedicine: 'Pomada Antialérgica', medicineCost: 35, recoveryWeeks: 1, healthImpact: -10, happinessImpact: -8 }
      ];
      const choice = diseaseTemplates[Math.floor(Math.random() * diseaseTemplates.length)];
      if (!p.activeIllnesses.some(i => i.id === choice.id)) {
        p.activeIllnesses.push({ ...choice });
        p.indicators.health = Math.max(0, p.indicators.health + choice.healthImpact);
        p.indicators.happiness = Math.max(0, p.indicators.happiness + choice.happinessImpact);
        logs.push(`🤒 Um membro da família contraiu '${choice.name}' (Chance: ${Math.round(diseaseChance*100)}%)! Vá à Farmácia.`);
      }
    }

    // Incrementar dia
    p.day += 1;

    // Resetar flags diárias
    p.tasksCompletedToday = [];
    p.ateToday = false;

    // Recuperar energia total (dormir)
    p.energy = 100;

    // Formatar notificação
    const msgStr = logs.length > 0 
      ? `Dia ${p.day - 1} finalizado. Ocorrências: ${logs.join('; ')}`
      : `Dia ${p.day - 1} finalizado com sucesso! Toda a rotina diária foi cumprida. Energia restaurada.`;
    
    p.notifications.unshift({ 
      type: logs.length > 0 ? 'warning' : 'success', 
      text: msgStr 
    });

    await db.saveParticipant(p);
    
    res.json({ 
      success: true, 
      message: logs.length > 0 
        ? `Você foi dormir. Algumas obrigações ficaram pendentes:\n- ${logs.join('\n- ')}` 
        : `Você dormiu bem! Toda a rotina diária foi cumprida. Energia restaurada. Bem-vindo ao Dia ${p.day}!`,
      participant: p
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao virar o dia.' });
  }
});

// Comprar Remédio
app.post('/api/participant/:id/buy-medicine', authenticateToken, async (req, res) => {
  const pId = req.params.id;
  const { diseaseId } = req.body;

  try {
    const p = await db.getParticipantById(pId);
    const illIdx = p.activeIllnesses.findIndex(i => i.id === diseaseId);
    if (illIdx === -1) return res.status(400).json({ message: 'Doença não ativa.' });

    const ill = p.activeIllnesses[illIdx];
    if (p.balance < ill.medicineCost) return res.status(400).json({ message: 'Saldo insuficiente.' });

    p.balance -= ill.medicineCost;
    p.activeIllnesses.splice(illIdx, 1);

    p.indicators.health = Math.min(100, p.indicators.health + Math.abs(ill.healthImpact) * 0.8);
    p.indicators.happiness = Math.min(100, p.indicators.happiness + Math.abs(ill.happinessImpact) * 0.8);
    p.notifications.unshift({ type: 'success', text: `Medicamento '${ill.requiredMedicine}' comprado. Doença curada!` });

    await db.saveParticipant(p);
    res.json({ success: true, message: 'Remédio comprado!' });
  } catch (err) {
    res.status(500).json({ message: 'Erro na farmácia.' });
  }
});

// --- ENCERRAMENTO DO MÊS (FUNÇÃO COMPARTILHADA DO BACKEND) ---

async function advanceParticipantWeekLogic(pId, adminName) {
  const p = await db.getParticipantById(pId);
  const campaign = await db.getActiveCampaign();
  if (!p || !campaign) throw new Error('Dados do participante ou campanha não encontrados.');

  const diff = INITIAL_DIFFICULTIES[campaign.difficulty];

  // 1. Salvar Snapshot Histórico
  const liquidAssets = p.balance + p.reserve + Object.values(p.investments).reduce((sum, v) => sum + v, 0);
  const debts = p.overdueBills.reduce((sum, b) => sum + (b.totalValue || b.value), 0) +
                p.loans.reduce((sum, l) => sum + (l.totalAmount - (l.paidTerms * l.monthlyPayment)), 0);
  const netWorth = liquidAssets - debts;

  const snap = {
    id: 'snap_' + p.id + '_' + p.week,
    participantId: p.id,
    week: p.week,
    balance: p.balance,
    reserve: p.reserve,
    investments: p.investments,
    indicators: p.indicators,
    debt: debts,
    netWorth
  };
  await db.addHistorySnapshot(snap);

  // 2. Recebimento de Salário
  let salaryApplied = p.salary;
  const workLoss = p.activeEvents.find(e => e.id === 'unemployment');
  if (workLoss) {
    salaryApplied = Math.round(p.salary * 0.3);
    p.notifications.unshift({ type: 'warning', text: 'Você recebeu apenas 30% do salário devido ao desemprego temporário.' });
  }
  p.balance += salaryApplied;

  // 3. Contas não pagas (Viram overdue com multas/juros)
  p.unpaidBills.forEach(bill => {
    const fine = Math.round(bill.value * (campaign.lateFee / 100));
    const interest = Math.round(bill.value * (campaign.interestRate / 100));
    
    p.overdueBills.push({
      id: bill.id, type: bill.type, name: bill.name + " (Atrasada)",
      value: bill.value, originalValue: bill.value, dueWeek: bill.dueWeek,
      fineApplied: fine, interestApplied: interest, totalValue: bill.value + fine + interest
    });

    p.indicators.happiness = Math.max(0, p.indicators.happiness - 8);
  });

  if (p.unpaidBills.length > 0) {
    p.notifications.unshift({ type: 'warning', text: `Você deixou ${p.unpaidBills.length} contas vencerem.` });
  }
  p.unpaidBills = [];

  // Juros acumulativos nas atrasadas
  p.overdueBills.forEach(bill => {
    const extraInterest = Math.round(bill.originalValue * (campaign.interestRate / 100));
    bill.interestApplied += extraInterest;
    bill.totalValue = bill.originalValue + bill.fineApplied + bill.interestApplied;
    p.indicators.happiness = Math.max(0, p.indicators.happiness - 4);
  });

  // 4. Cobrança de Parcelas de Empréstimos
  let totalPMTs = 0;
  p.loans.forEach(loan => {
    if (loan.paidTerms < loan.term) {
      totalPMTs += loan.monthlyPayment;
      loan.paidTerms += 1;
    }
  });

  if (totalPMTs > 0) {
    if (p.balance >= totalPMTs) {
      p.balance -= totalPMTs;
      p.notifications.unshift({ type: 'info', text: `Débito de R$ ${totalPMTs.toFixed(2)} das parcelas de empréstimos.` });
    } else {
      const unpaid = totalPMTs - p.balance;
      p.balance = 0;
      p.overdueBills.push({
        id: 'loan_fail_' + p.week + '_' + Math.random().toString(36).substr(2, 3),
        type: 'loan_repay', name: 'Parcela de Empréstimo Inadimplida',
        value: unpaid, originalValue: unpaid, dueWeek: p.week,
        fineApplied: Math.round(unpaid * 0.05), interestApplied: Math.round(unpaid * 0.03),
        totalValue: Math.round(unpaid * 1.08)
      });
      p.indicators.happiness = Math.max(0, p.indicators.happiness - 15);
      p.notifications.unshift({ type: 'danger', text: 'Você não tinha saldo para pagar o empréstimo! Encargos cobrados.' });
    }
  }

  // 5. Rendimentos de Investimentos
  let totalEarn = 0;
  for (const prodId of Object.keys(p.investments)) {
    const amt = p.investments[prodId] || 0;
    if (amt > 0) {
      const prod = DEFAULT_INVESTMENT_PRODUCTS.find(x => x.id === prodId);
      let rate = prod.monthlyYield;
      if (prod.isVariable) rate = -0.04 + Math.random() * 0.10;
      const earn = Math.round(amt * rate);
      p.investments[prodId] += earn;
      totalEarn += earn;
    }
  }

  if (totalEarn > 0) p.notifications.unshift({ type: 'success', text: `Rendimento de investimentos: R$ ${totalEarn.toFixed(2)}.` });
  else if (totalEarn < 0) p.notifications.unshift({ type: 'warning', text: `Queda no Fundo de Ações de R$ ${Math.abs(totalEarn).toFixed(2)}.` });

  // 6. Regra da Fome Crítica (Se não comprou comida, Saúde e Felicidade caem para 0%)
  if (!p.boughtFoodThisMonth) {
    p.indicators.health = 0;
    p.indicators.happiness = 0;
    p.notifications.unshift({ 
      type: 'danger', 
      text: '🚨 FOME CRÍTICA: Sua família passou o mês sem alimentos! Saúde e Felicidade caíram para 0%!' 
    });
  }
  p.boughtFoodThisMonth = false; // Reseta para o próximo mês

  // 7. Decaimento natural de Limpeza/Saúde
  const sizeMult = p.family.baseExpensesMultiplier;
  p.indicators.cleanliness = Math.max(0, p.indicators.cleanliness - Math.round(15 * sizeMult));
  
  let healthDec = 5;
  if (p.indicators.cleanliness < 40) {
    healthDec += 15;
    p.notifications.unshift({ type: 'warning', text: 'Saúde da família prejudicada devido à casa suja!' });
  }
  p.indicators.health = Math.max(0, p.indicators.health - healthDec);

  const finalDebts = p.overdueBills.reduce((s, b) => s + (b.totalValue || b.value), 0) +
                     p.loans.reduce((s, l) => s + (l.totalAmount - (l.paidTerms * l.monthlyPayment)), 0);
  if (finalDebts > p.salary * 1.5) {
    p.indicators.happiness = Math.max(0, p.indicators.happiness - 15);
    p.notifications.unshift({ type: 'warning', text: 'Dívidas excessivas estão prejudicando a felicidade familiar.' });
  }

  // Penalidades de Quebras Ativas (Problemas Estruturais)
  p.activeEvents.forEach(evt => {
    if (evt.isBreakdown) {
      p.indicators.cleanliness = Math.max(0, p.indicators.cleanliness - 15);
      p.indicators.happiness = Math.max(0, p.indicators.happiness - 10);
      p.notifications.unshift({ 
        type: 'warning', 
        text: `🔧 Manutenção Pendente: O problema '${evt.name}' está deteriorando o ambiente e o bem-estar!` 
      });
    }
  });

  // 8. Tratamento de Doenças
  p.activeIllnesses.forEach(ill => {
    ill.recoveryWeeks -= 1;
    p.indicators.health = Math.max(0, p.indicators.health + ill.healthImpact * 0.5);
    p.indicators.happiness = Math.max(0, p.indicators.happiness + ill.happinessImpact * 0.5);
  });

  p.activeIllnesses = p.activeIllnesses.filter(ill => {
    if (ill.recoveryWeeks <= 0) {
      p.notifications.unshift({ type: 'success', text: `A doença '${ill.name}' terminou seu ciclo natural.` });
      return false;
    }
    return true;
  });

  if (p.indicators.cleanliness < 35 || p.indicators.health < 40) {
    if (Math.random() < diff.diseaseProbability * 2.0) {
      const dTemplate = DEFAULT_DISEASES[Math.floor(Math.random() * DEFAULT_DISEASES.length)];
      if (!p.activeIllnesses.some(x => x.id === dTemplate.id)) {
        p.activeIllnesses.push({ ...dTemplate });
        p.indicators.health = Math.max(0, p.indicators.health + dTemplate.healthImpact);
        p.indicators.happiness = Math.max(0, p.indicators.happiness + dTemplate.happinessImpact);
        p.notifications.unshift({ type: 'danger', text: `Falta de higiene causou a doença: '${dTemplate.name}'. Vá à Farmácia!` });
      }
    }
  }

  // 9. Eventos Aleatórios & Quebras Estruturais
  if (Math.random() < diff.eventProbability) {
    const event = DEFAULT_EVENTS[Math.floor(Math.random() * DEFAULT_EVENTS.length)];
    
    // Mapear eventos específicos para "quebras" que requerem manutenção ativa
    const breakdownIds = ['pipe_leak', 'fridge_repair'];
    const isBreakdown = breakdownIds.includes(event.id);

    if (isBreakdown) {
      p.activeEvents.push({
        id: event.id,
        name: event.name,
        description: event.description,
        impact: 0, // Custo cobrado apenas se consertar
        tip: event.educationalTip,
        weekTriggered: p.week,
        isBreakdown: true,
        repairCost: Math.abs(event.financialImpact)
      });
      p.notifications.unshift({ 
        type: 'danger', 
        text: `🚨 QUEBRA: ${event.name}! Chame manutenção na aba 'Consertos da Casa' (Reparo: R$ ${Math.abs(event.financialImpact)}).` 
      });
    } else {
      p.balance += event.financialImpact;
      p.indicators.health = Math.max(0, Math.min(100, p.indicators.health + event.healthImpact));
      p.indicators.happiness = Math.max(0, Math.min(100, p.indicators.happiness + event.happinessImpact));
      p.indicators.cleanliness = Math.max(0, Math.min(100, p.indicators.cleanliness + event.cleanlinessImpact));

      p.activeEvents.push({
        id: event.id, name: event.name, description: event.description,
        impact: event.financialImpact, tip: event.educationalTip, weekTriggered: p.week
      });
      p.notifications.unshift({ type: event.category === 'positive' ? 'success' : 'danger', text: `EVENTO: ${event.name}! ${event.description}` });
    }
  }

  // Limpar eventos normais antigos, manter breakdowns não consertados
  p.activeEvents = p.activeEvents.filter(e => e.weekTriggered === p.week || e.isBreakdown);

  // 10. Atualizar indicador financeiro
  const finalAssets = p.balance + p.reserve + Object.values(p.investments).reduce((sum, v) => sum + v, 0);
  let finScore = 50;
  if (debts === 0) {
    finScore = finalAssets > p.salary ? 95 : 75;
  } else {
    const ratio = finalAssets / (debts + 1);
    if (ratio >= 2) finScore = 90;
    else if (ratio >= 1) finScore = 70;
    else if (ratio >= 0.5) finScore = 50;
    else if (ratio >= 0.2) finScore = 30;
    else finScore = 15;
  }
  p.indicators.financial = finScore;

  // 11. Objetivos da Campanha
  campaign.goals.forEach(goal => {
    let status = p.goalsStatus[goal.id] || "in_progress";
    if (status === "in_progress") {
      if (goal.targetType === "reserve" && p.reserve >= goal.targetValue) status = "completed";
      if (goal.targetType === "no_loans" && p.loans.length > 0) status = "failed";
      if (goal.targetType === "investments") {
        const totalInvested = Object.values(p.investments).reduce((s, v) => s + v, 0);
        if (totalInvested >= goal.targetValue) status = "completed";
      }
      if (p.week >= campaign.durationWeeks) {
        if (goal.targetType === "health") status = p.indicators.health >= goal.targetValue ? "completed" : "failed";
        if (goal.targetType === "happiness") status = p.indicators.happiness >= goal.targetValue ? "completed" : "failed";
        if (goal.targetType === "no_loans") status = p.loans.length === 0 ? "completed" : "failed";
      }

      if (status !== "in_progress") {
        p.goalsStatus[goal.id] = status;
        p.notifications.unshift({
          type: status === 'completed' ? 'success' : 'danger',
          text: `Objetivo '${goal.name}' ${status === 'completed' ? 'Concluído! (+' + goal.points + ' pts)' : 'Falhou!'}`
        });
      }
    }
  });

  // 12. Incrementar tempo
  p.week += 1;
  p.day = 1;
  p.energy = 100;
  p.tasksCompletedThisWeek = [];
  p.extraIncomeCompletedThisWeek = [];

  if (p.week > campaign.durationWeeks) {
    p.finished = 1;
    p.notifications.unshift({ type: 'success', text: 'Parabéns! Você concluiu a simulação "Missão Família"!' });
  } else {
    activeCampaignBillsSeed(p, campaign, sizeMult, diff.costMultiplier);
  }

  await db.saveParticipant(p);

  // Registro de Auditoria
  await db.addAuditLog({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
    timestamp: new Date().toISOString(),
    username: adminName,
    action: 'Mês Avançado',
    details: `Fechamento de contas do Mês ${p.week - 1} rodado para ${p.name}.`
  });
}

function activeCampaignBillsSeed(p, campaign, sizeMult, costMult) {
  campaign.accountsConfig.forEach(cfg => {
    if (cfg.enabled) {
      const val = cfg.minVal + Math.random() * (cfg.maxVal - cfg.minVal);
      p.unpaidBills.push({
        id: 'bill_' + cfg.id + '_' + p.week + '_' + Math.random().toString(36).substr(2, 4),
        type: cfg.id, name: cfg.name, value: Math.round(val * sizeMult * costMult), dueWeek: p.week
      });
    }
  });

  const categories = [
    { id: 'transporte', name: 'Combustível/Transporte Público', perc: campaign.expensesPercentages.transporte },
    { id: 'saude', name: 'Plano de Saúde / Higiene Familiar', perc: campaign.expensesPercentages.saude },
    { id: 'higiene', name: 'Produtos de Limpeza e Higiene', perc: campaign.expensesPercentages.higiene },
    { id: 'educacao', name: 'Mensalidades / Material Escolar', perc: campaign.expensesPercentages.educacao }
  ];
  categories.forEach(cat => {
    if (cat.perc > 0) {
      let val = (p.salary * (cat.perc / 100)) * (0.9 + Math.random() * 0.2);
      p.unpaidBills.push({
        id: 'bill_' + cat.id + '_' + p.week + '_' + Math.random().toString(36).substr(2, 4),
        type: cat.id, name: cat.name, value: Math.round(val * sizeMult * costMult), dueWeek: p.week
      });
    }
  });
}

// --- ROTAS DO ADMINISTRADOR (AVANÇO DE CICLOS) ---

// Avançar mês de participante específico
app.post('/api/admin/advance-cycle', authenticateToken, requireAdmin, async (req, res) => {
  const { participantId } = req.body;
  if (!participantId) return res.status(400).json({ message: 'ID do participante não fornecido.' });

  try {
    const p = await db.getParticipantById(participantId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });
    if (p.finished === 1) return res.status(400).json({ message: 'A simulação deste participante já foi finalizada.' });

    await advanceParticipantWeekLogic(participantId, req.user.name);
    res.json({ success: true, message: `Ciclo do participante ${p.name} avançado para o Mês ${p.week + 1}!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Erro ao avançar ciclo.' });
  }
});

// Avançar mês de todos os participantes ativos
app.post('/api/admin/advance-all-cycles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await db.getParticipants();
    const activeOnes = list.filter(p => p.finished === 0);

    if (activeOnes.length === 0) {
      return res.status(400).json({ message: 'Não há participantes ativos na simulação para avançar.' });
    }

    let count = 0;
    for (const p of activeOnes) {
      await advanceParticipantWeekLogic(p.id, req.user.name);
      count++;
    }

    res.json({ success: true, message: `Ciclo avançado com sucesso para todas as ${count} famílias ativas!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao avançar ciclo de todas as famílias.' });
  }
});

// Aprovar Empréstimo
app.post('/api/admin/approve-loan', authenticateToken, requireAdmin, async (req, res) => {
  const { participantId, loanId, action, modifiedParams } = req.body;

  try {
    const p = await db.getParticipantById(participantId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    const reqIdx = p.pendingLoans.findIndex(x => x.id === loanId);
    if (reqIdx === -1) return res.status(400).json({ message: 'Pedido de empréstimo não encontrado.' });

    const loanReq = p.pendingLoans[reqIdx];

    if (action === 'approved') {
      let finalAmt = modifiedParams ? parseInt(modifiedParams.amount) : loanReq.amount;
      let finalTerm = modifiedParams ? parseInt(modifiedParams.term) : loanReq.term;
      let finalRate = modifiedParams ? parseFloat(modifiedParams.rate) : loanReq.rate;

      const monthlyRate = finalRate / 100;
      const pmt = finalAmt * (monthlyRate * Math.pow(1 + monthlyRate, finalTerm)) / (Math.pow(1 + monthlyRate, finalTerm) - 1);

      const newLoan = {
        id: 'loan_' + Date.now(),
        amount: finalAmt,
        term: finalTerm,
        rate: finalRate,
        monthlyPayment: Math.round(pmt * 100) / 100,
        totalAmount: Math.round(pmt * finalTerm * 100) / 100,
        paidTerms: 0,
        justification: loanReq.justification,
        dateApproved: new Date().toISOString()
      };

      p.loans.push(newLoan);
      p.balance += finalAmt;
      p.notifications.unshift({ type: 'success', text: `Seu empréstimo de R$ ${finalAmt} foi Aprovado pelo Diretor!` });

      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: req.user.name,
        action: 'Empréstimo Aprovado',
        details: `Aprovado empréstimo de R$ ${finalAmt} para ${p.name}.`
      });
    } else {
      p.notifications.unshift({ type: 'danger', text: `Seu pedido de empréstimo de R$ ${loanReq.amount} foi Recusado pelo Diretor.` });
      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: req.user.name,
        action: 'Empréstimo Rejeitado',
        details: `Rejeitado empréstimo de R$ ${loanReq.amount} de ${p.name}.`
      });
    }

    p.pendingLoans.splice(reqIdx, 1);
    await db.saveParticipant(p);

    res.json({ success: true, message: `Solicitação resolvida!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao processar empréstimo.' });
  }
});

// Aprovar Renda Extra
app.post('/api/admin/approve-income', authenticateToken, requireAdmin, async (req, res) => {
  const { participantId, activityId, action } = req.body;

  try {
    const p = await db.getParticipantById(participantId);
    if (!p) return res.status(404).json({ message: 'Participante não encontrado.' });

    const reqIdx = p.customExtraIncomePending.findIndex(x => x.id === activityId);
    if (reqIdx === -1) return res.status(400).json({ message: 'Proposta de Renda Extra não encontrada.' });

    const reqInc = p.customExtraIncomePending[reqIdx];

    if (action === 'approved') {
      p.balance += reqInc.estimatedReward;
      p.notifications.unshift({ type: 'success', text: `Sua renda extra '${reqInc.name}' foi aprovada! R$ ${reqInc.estimatedReward} creditados.` });

      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: req.user.name,
        action: 'Renda Extra Aprovada',
        details: `Aprovada renda extra '${reqInc.name}' para ${p.name}.`
      });
    } else {
      p.notifications.unshift({ type: 'danger', text: `Sua proposta de renda extra '${reqInc.name}' foi rejeitada pelo Diretor.` });
      await db.addAuditLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        username: req.user.name,
        action: 'Renda Extra Rejeitada',
        details: `Rejeitada proposta '${reqInc.name}' de ${p.name}.`
      });
    }

    p.customExtraIncomePending.splice(reqIdx, 1);
    await db.saveParticipant(p);

    res.json({ success: true, message: `Atividade resolvida!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao processar renda extra.' });
  }
});

// Auditoria
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao carregar logs.' });
  }
});

// --- SERVIR ARQUIVOS ESTÁTICOS DA SPA ---
app.use(express.static(path.join(__dirname, '..')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- INICIALIZAR PORTA (APENAS EM DEV LOCAL) ---
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Servidor de Desenvolvimento rodando localmente em http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

// Exportar Express app para o Vercel Serverless Functions Builder
export default app;
