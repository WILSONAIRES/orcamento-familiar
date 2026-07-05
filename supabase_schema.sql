-- Script de Inicialização de Tabelas para o Supabase (PostgreSQL)
-- Cole este script no SQL Editor do Supabase e clique em 'Run' para inicializar a estrutura.

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'instructor', 'participant')),
    name TEXT NOT NULL,
    clube TEXT,
    unidade TEXT,
    age INTEGER
);

-- 2. Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    durationWeeks INTEGER DEFAULT 12,
    familyTypeId TEXT DEFAULT 'padrao',
    salaryType TEXT DEFAULT 'fixed',
    fixedSalary INTEGER DEFAULT 2500,
    minSalary INTEGER DEFAULT 2000,
    maxSalary INTEGER DEFAULT 3000,
    expensesPercentages JSONB NOT NULL,
    accountsConfig JSONB NOT NULL,
    lateFee REAL DEFAULT 2.0,
    interestRate REAL DEFAULT 1.0,
    cutoffDays JSONB,
    loanConfig JSONB NOT NULL,
    investmentsEnabled JSONB NOT NULL,
    weights JSONB NOT NULL,
    rankingEnabled INTEGER DEFAULT 1,
    goals JSONB NOT NULL,
    active INTEGER DEFAULT 1
);

-- 3. Tabela de Participantes (Fichas do Jogo)
CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    campaignId TEXT,
    week INTEGER DEFAULT 1,
    finished INTEGER DEFAULT 0,
    balance REAL DEFAULT 1000.0,
    reserve REAL DEFAULT 0.0,
    salary REAL DEFAULT 2500.0,
    family JSONB NOT NULL,
    loans JSONB NOT NULL,
    pendingLoans JSONB NOT NULL,
    investments JSONB NOT NULL,
    indicators JSONB NOT NULL,
    energy INTEGER DEFAULT 100,
    activeIllnesses JSONB NOT NULL,
    activeEvents JSONB NOT NULL,
    unpaidBills JSONB NOT NULL,
    overdueBills JSONB NOT NULL,
    tasksCompletedThisWeek JSONB NOT NULL,
    extraIncomeCompletedThisWeek JSONB NOT NULL,
    customExtraIncomePending JSONB NOT NULL,
    goalsStatus JSONB NOT NULL,
    notifications JSONB NOT NULL,
    boughtFoodThisMonth BOOLEAN DEFAULT FALSE
);

-- 4. Tabela de Histórico (Snapshots Mensais)
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    participantId TEXT REFERENCES participants(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    balance REAL NOT NULL,
    reserve REAL NOT NULL,
    investments JSONB NOT NULL,
    indicators JSONB NOT NULL,
    debt REAL NOT NULL,
    netWorth REAL NOT NULL
);

-- 5. Tabela de Auditoria do Administrador
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

-- Índices para otimização de pesquisas
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(userId);
CREATE INDEX IF NOT EXISTS idx_history_participant ON history(participantId);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
