/**
 * Missão Família - Adaptador de Banco de Dados Supabase (Postgres)
 * Persistência online segura utilizando o Supabase client SDK
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Chave service_role (privilegiada)

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// --- MAPPER AUXILIAR PARA CAMPANHA ---
function mapCampaignFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty,
    durationWeeks: row.durationweeks,
    familyTypeId: row.familytypeid,
    salaryType: row.salarytype,
    fixedSalary: row.fixedsalary,
    minSalary: row.minsalary,
    maxSalary: row.maxsalary,
    cycleTransitionDay: row.cycletransitionday,
    lastCycleAdvanceDate: row.lastcycleadvancedate,
    expensesPercentages: row.expensespercentages,
    accountsConfig: row.accountsconfig,
    lateFee: row.latefee,
    interestRate: row.interestrate,
    cutoffDays: row.cutoffdays,
    loanConfig: row.loanconfig,
    investmentsEnabled: row.investmentsenabled,
    weights: row.weights,
    rankingEnabled: row.rankingenabled,
    goals: row.goals,
    active: row.active
  };
}

function mapCampaignToDb(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    difficulty: c.difficulty,
    durationweeks: c.durationWeeks,
    familytypeid: c.familyTypeId,
    salarytype: c.salaryType,
    fixedsalary: c.fixedSalary,
    minsalary: c.minSalary,
    maxsalary: c.maxSalary,
    cycletransitionday: c.cycleTransitionDay,
    lastcycleadvancedate: c.lastCycleAdvanceDate,
    expensespercentages: c.expensesPercentages,
    accountsconfig: c.accountsConfig,
    latefee: c.lateFee,
    interestrate: c.interestRate,
    cutoffdays: c.cutoffDays,
    loanconfig: c.loanConfig,
    investmentsenabled: c.investmentsEnabled,
    weights: c.weights,
    rankingenabled: c.rankingEnabled,
    goals: c.goals,
    active: c.active
  };
}

// --- MAPPER AUXILIAR PARA PARTICIPANTE ---
function mapParticipantFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userid,
    campaignId: row.campaignid,
    week: row.week,
    finished: row.finished,
    balance: row.balance,
    reserve: row.reserve,
    salary: row.salary,
    family: row.family,
    loans: row.loans,
    pendingLoans: row.pendingloans,
    investments: row.investments,
    indicators: row.indicators,
    energy: row.energy,
    activeIllnesses: row.activeillnesses,
    activeEvents: row.activeevents,
    unpaidBills: row.unpaidbills,
    overdueBills: row.overduebills,
    tasksCompletedThisWeek: row.taskscompletedthisweek,
    extraIncomeCompletedThisWeek: row.extraincomecompletedthisweek,
    customExtraIncomePending: row.customextraincomepending,
    goalsStatus: row.goalsstatus,
    notifications: row.notifications,
    boughtFoodThisMonth: row.boughtfoodthismonth,
    cleaningProductsStock: row.cleaningproductsstock,
    day: row.day,
    tasksCompletedToday: row.taskscompletedtoday,
    ateToday: row.atetoday,
    lastDayTransitionDate: row.lastdaytransitiondate,
    foodStockBasic: row.foodstockbasic,
    foodStockHealthy: row.foodstockhealthy,
    foodStockPremium: row.foodstockpremium
  };
}

function mapParticipantToDb(p) {
  if (!p) return null;
  return {
    id: p.id,
    userid: p.userId,
    campaignid: p.campaignId,
    week: p.week,
    finished: p.finished,
    balance: p.balance,
    reserve: p.reserve,
    salary: p.salary,
    family: p.family,
    loans: p.loans,
    pendingloans: p.pendingLoans,
    investments: p.investments,
    indicators: p.indicators,
    energy: p.energy,
    activeillnesses: p.activeIllnesses,
    activeevents: p.activeEvents,
    unpaidbills: p.unpaidBills,
    overduebills: p.overdueBills,
    taskscompletedthisweek: p.tasksCompletedThisWeek,
    extraincomecompletedthisweek: p.extraIncomeCompletedThisWeek,
    customextraincomepending: p.customExtraIncomePending,
    goalsstatus: p.goalsStatus,
    notifications: p.notifications,
    boughtfoodthismonth: p.boughtFoodThisMonth,
    cleaningproductsstock: p.cleaningProductsStock,
    day: p.day,
    taskscompletedtoday: p.tasksCompletedToday,
    atetoday: p.ateToday,
    lastdaytransitiondate: p.lastDayTransitionDate,
    foodstockbasic: p.foodStockBasic,
    foodstockhealthy: p.foodStockHealthy,
    foodstockpremium: p.foodStockPremium
  };
}

// --- MAPPER AUXILIAR PARA HISTÓRICO ---
function mapHistoryFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    participantId: row.participantid,
    week: row.week,
    balance: row.balance,
    reserve: row.reserve,
    investments: row.investments,
    indicators: row.indicators,
    debt: row.debt,
    netWorth: row.networth
  };
}

function mapHistoryToDb(h) {
  if (!h) return null;
  return {
    id: h.id,
    participantid: h.participantId,
    week: h.week,
    balance: h.balance,
    reserve: h.reserve,
    investments: h.investments,
    indicators: h.indicators,
    debt: h.debt,
    networth: h.netWorth
  };
}

class SupabaseDbAdapter {
  // --- USUÁRIOS ---

  async getUser(username) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', username.toLowerCase())
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  async getUserById(id) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createUser(user) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('users')
      .insert([user]);

    if (error) throw error;
    return user;
  }

  // --- CAMPANHAS ---

  async getActiveCampaign() {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('active', 1)
      .maybeSingle();

    if (error) throw error;
    return mapCampaignFromDb(data);
  }

  async updateCampaign(campaign) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const toSave = mapCampaignToDb(campaign);
    const { error } = await supabase
      .from('campaigns')
      .update(toSave)
      .eq('id', toSave.id);

    if (error) throw error;
    return campaign;
  }

  // --- PARTICIPANTES ---

  async getParticipants() {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('participants')
      .select('*, users(name, clube, unidade, age)');

    if (error) throw error;

    // Achatamento da junção de tabelas
    return data.map(row => {
      const u = row.users || {};
      const p = mapParticipantFromDb(row);
      return {
        ...p,
        name: u.name || 'Desbravador',
        clube: u.clube || '',
        unidade: u.unidade || '',
        age: u.age || 0
      };
    });
  }

  async getParticipantById(id) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('participants')
      .select('*, users(name, clube, unidade, age)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const u = data.users || {};
    const p = mapParticipantFromDb(data);

    return {
      ...p,
      name: u.name,
      clube: u.clube,
      unidade: u.unidade,
      age: u.age
    };
  }

  async getParticipantByUserId(userId) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('participants')
      .select('*, users(name, clube, unidade, age)')
      .eq('userid', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const u = data.users || {};
    const p = mapParticipantFromDb(data);

    return {
      ...p,
      name: u.name,
      clube: u.clube,
      unidade: u.unidade,
      age: u.age
    };
  }

  async createParticipant(participant) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const toInsert = mapParticipantToDb(participant);
    const { error } = await supabase
      .from('participants')
      .insert([toInsert]);

    if (error) throw error;
    return participant;
  }

  async saveParticipant(participant) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const mapped = mapParticipantToDb(participant);

    const { error } = await supabase
      .from('participants')
      .update(mapped)
      .eq('id', mapped.id);

    if (error) throw error;
    return participant;
  }

  // --- HISTÓRICO SNAPSHOTS ---

  async addHistorySnapshot(snap) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const toInsert = mapHistoryToDb(snap);
    const { error } = await supabase
      .from('history')
      .upsert([toInsert]);

    if (error) throw error;
    return snap;
  }

  async getHistory(participantId) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('participantid', participantId);

    if (error) throw error;
    return data.map(mapHistoryFromDb);
  }

  // --- AUDITORIA ---

  async addAuditLog(log) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('audit_logs')
      .insert([log]);

    if (error) throw error;
    return log;
  }

  async getAuditLogs() {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data;
  }

  async deleteParticipant(id) {
    if (!supabase) throw new Error("Supabase não configurado.");
    
    // Deleta do histórico primeiro
    const { error: histError } = await supabase
      .from('history')
      .delete()
      .eq('participantid', id);
    if (histError) throw histError;

    // Deleta participante
    const { error: partError } = await supabase
      .from('participants')
      .delete()
      .eq('id', id);
    if (partError) throw partError;
    
    return true;
  }

  async deleteUser(userId) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (error) throw error;
    
    return true;
  }
}

export const supabaseAdapter = new SupabaseDbAdapter();
