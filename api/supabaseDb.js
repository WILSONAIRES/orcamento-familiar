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

class SupabaseDbAdapter {
  // --- USUÁRIOS ---

  async getUser(username) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
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
    return data;
  }

  async updateCampaign(campaign) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('campaigns')
      .update(campaign)
      .eq('id', campaign.id);

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
    return data.map(p => {
      const u = p.users || {};
      const result = { ...p };
      delete result.users;
      return {
        ...result,
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
    const result = { ...data };
    delete result.users;

    return {
      ...result,
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
      .eq('userId', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const u = data.users || {};
    const result = { ...data };
    delete result.users;

    return {
      ...result,
      name: u.name,
      clube: u.clube,
      unidade: u.unidade,
      age: u.age
    };
  }

  async createParticipant(participant) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('participants')
      .insert([participant]);

    if (error) throw error;
    return participant;
  }

  async saveParticipant(participant) {
    if (!supabase) throw new Error("Supabase não configurado.");
    
    // Remover propriedades achatas que pertencem à tabela 'users' para evitar erros de coluna inexistente
    const toSave = { ...participant };
    delete toSave.name;
    delete toSave.clube;
    delete toSave.unidade;
    delete toSave.age;
    delete toSave.history;

    const { error } = await supabase
      .from('participants')
      .update(toSave)
      .eq('id', toSave.id);

    if (error) throw error;
    return participant;
  }

  // --- HISTÓRICO SNAPSHOTS ---

  async addHistorySnapshot(snap) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { error } = await supabase
      .from('history')
      .upsert([snap]);

    if (error) throw error;
    return snap;
  }

  async getHistory(participantId) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('participantId', participantId);

    if (error) throw error;
    return data;
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
}

export const supabaseAdapter = new SupabaseDbAdapter();
