-- Script de Inicialização de Tabelas para o Supabase (PostgreSQL)
-- Cole este script no SQL Editor do Supabase e clique em 'Run' para inicializar a estrutura.

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Nulo para logins via Supabase Auth / Google OAuth
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
    cycleTransitionDay TEXT DEFAULT 'Domingo',
    lastCycleAdvanceDate TEXT,
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
    boughtFoodThisMonth BOOLEAN DEFAULT FALSE,
    cleaningProductsStock INTEGER DEFAULT 5,
    day INTEGER DEFAULT 1,
    tasksCompletedToday JSONB DEFAULT '[]'::jsonb,
    ateToday BOOLEAN DEFAULT FALSE,
    lastDayTransitionDate TEXT
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

-- 6. Inserir Campanha Padrão Ativa
INSERT INTO campaigns (
    id, name, difficulty, durationWeeks, familyTypeId, salaryType, fixedSalary, minSalary, maxSalary,
    cycleTransitionDay, lastCycleAdvanceDate, expensesPercentages, accountsConfig, lateFee, interestRate, cutoffDays,
    loanConfig, investmentsEnabled, weights, rankingEnabled, goals, active
) VALUES (
    'camp_2026', 'Especialidade Orçamento 2026', 'medio', 12, 'padrao', 'fixed', 2500, 2000, 3000,
    'Domingo', '', 
    '{"alimentacao": 25, "moradia": 25, "transporte": 10, "saude": 10, "higiene": 5, "educacao": 10, "lazer": 10}',
    '[{"id": "agua", "name": "Conta de Água", "enabled": true, "minVal": 50, "maxVal": 90}, {"id": "luz", "name": "Conta de Luz", "enabled": true, "minVal": 120, "maxVal": 200}, {"id": "internet", "name": "Internet Banda Larga", "enabled": true, "minVal": 90, "maxVal": 110}, {"id": "gas", "name": "Gás de Cozinha", "enabled": true, "minVal": 110, "maxVal": 130}, {"id": "aluguel", "name": "Aluguel Residencial", "enabled": true, "minVal": 700, "maxVal": 800}]',
    2.0, 1.0, 
    '{"luz": 15, "internet": 10, "agua": 20}',
    '{"minRate": 3, "maxRate": 8, "minTerm": 3, "maxTerm": 12, "minVal": 200, "maxVal": 4000, "requireApproval": true}',
    '["poupanca", "cdb", "tesouro_direto", "fundo_acoes"]',
    '{"health": 30, "happiness": 30, "finance": 25, "cleanliness": 15}', 
    1,
    '[{"id": "goal_reserve", "name": "Criar Reserva de Emergência", "description": "Guardar pelo menos R$ 500 na poupança ou CDB", "targetField": "reserve", "targetValue": 500}, {"id": "goal_no_overdue", "name": "Nome Limpo", "description": "Terminar o ciclo sem nenhuma conta em atraso", "targetField": "overdueBillsCount", "targetValue": 0}]',
    1
) ON CONFLICT (id) DO NOTHING;
