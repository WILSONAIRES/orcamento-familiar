/**
 * Missão Família - Roteador de Banco de Dados Central
 * Escolhe dinamicamente entre persistência local (JSON) ou nuvem (Supabase)
 */

import { localAdapter } from './localDb.js';
import { supabaseAdapter } from './supabaseDb.js';

const isSupabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;

if (isSupabaseConfigured) {
  console.log("🔌 BANCO DE DADOS ATIVO: Supabase (Postgres em Nuvem)");
} else {
  console.log("💾 BANCO DE DADOS ATIVO: Local JSON File (db.json)");
  console.log("👉 Dica: Adicione as variáveis SUPABASE_URL e SUPABASE_KEY no ambiente para usar o banco online.");
}

export const db = isSupabaseConfigured ? supabaseAdapter : localAdapter;
