/**
 * Missão Família - Simulador de Orçamento Familiar
 * Dados padrão e configurações iniciais para o simulador.
 */

export const INITIAL_DIFFICULTIES = {
  facil: {
    name: "Fácil",
    eventProbability: 0.15, // 15% de chance de evento por semana
    diseaseProbability: 0.05, // 5% de chance de doença se a saúde/limpeza estiverem razoáveis
    costMultiplier: 0.8,    // Custos de despesas reduzidos
    incomeMultiplier: 1.2,  // Salário/Renda extra 20% maior
    startingBalance: 1500   // Saldo inicial extra
  },
  medio: {
    name: "Médio",
    eventProbability: 0.30, // 30% de chance de evento por semana
    diseaseProbability: 0.15, // 15% de chance de doença
    costMultiplier: 1.0,    // Custos padrão
    incomeMultiplier: 1.0,  // Renda padrão
    startingBalance: 800    // Saldo inicial padrão
  },
  dificil: {
    name: "Difícil",
    eventProbability: 0.50, // 50% de chance de evento
    diseaseProbability: 0.30, // 30% de chance de doença
    costMultiplier: 1.2,    // Custos 20% mais caros
    incomeMultiplier: 0.85, // Salários/Renda extra reduzidos
    startingBalance: 300    // Saldo inicial apertado
  }
};

export const DEFAULT_EXTRA_INCOME_ACTIVITIES = [
  {
    id: "candy_sale",
    name: "Venda de Doces Caseiros",
    description: "Fazer brigadeiros e trufas para vender na escola, igreja ou vizinhança.",
    baseReward: 180,
    daysRequired: 2,
    happinessImpact: 5,
    cleanlinessImpact: -5,
    executionCost: 40,
    successProbability: 0.85
  },
  {
    id: "car_wash",
    name: "Lavagem de Carros",
    description: "Oferecer serviço de lavagem ecológica de carros para os vizinhos no fim de semana.",
    baseReward: 150,
    daysRequired: 1,
    happinessImpact: -2,
    healthImpact: -3,
    cleanlinessImpact: 0,
    executionCost: 25,
    successProbability: 0.75
  },
  {
    id: "dog_walker",
    name: "Passeador de Cães (Dog Walker)",
    description: "Passear com cães da vizinhança durante a semana.",
    baseReward: 120,
    daysRequired: 2,
    happinessImpact: 8,
    healthImpact: 5,
    cleanlinessImpact: 0,
    executionCost: 10,
    successProbability: 0.90
  },
  {
    id: "handicraft",
    name: "Artesanato e Reciclagem",
    description: "Criar itens decorativos a partir de materiais recicláveis e vender.",
    baseReward: 200,
    daysRequired: 3,
    happinessImpact: 6,
    cleanlinessImpact: -3,
    executionCost: 50,
    successProbability: 0.80
  }
];

export const DEFAULT_DISEASES = [
  {
    id: "gripe",
    name: "Gripe Comum",
    description: "Febre baixa, coriza e dor no corpo. Exige repouso e antitérmico.",
    probability: 0.15,
    requiredMedicine: "Antitérmico e Vitamina C",
    medicineCost: 45,
    recoveryWeeks: 1,
    healthImpact: -15,
    happinessImpact: -10
  },
  {
    id: "infeccao_intestinal",
    name: "Infecção Intestinal",
    description: "Causada por alimentação inadequada ou falta de higiene na cozinha.",
    probability: 0.10,
    requiredMedicine: "Antibiótico e Soro de Reidratação",
    medicineCost: 80,
    recoveryWeeks: 1,
    healthImpact: -25,
    happinessImpact: -15
  },
  {
    id: "estresse_extremo",
    name: "Cansaço Extremo / Estresse",
    description: "Esgotamento físico e mental devido a excesso de trabalho ou preocupação financeira.",
    probability: 0.20,
    requiredMedicine: "Polivitamínico e Lazer",
    medicineCost: 60,
    recoveryWeeks: 2,
    healthImpact: -20,
    happinessImpact: -25
  },
  {
    id: "alergia_pele",
    name: "Alergia de Pele",
    description: "Reação alérgica causada por poeira ou acúmulo de sujeira na residência.",
    probability: 0.12,
    requiredMedicine: "Pomada Antialérgica",
    medicineCost: 35,
    recoveryWeeks: 1,
    healthImpact: -10,
    happinessImpact: -8
  }
];

export const DEFAULT_EVENTS = [
  // Eventos Negativos
  {
    id: "car_repair",
    name: "Carro Quebrado",
    description: "O carro da família quebrou a caminho do trabalho. O conserto da junta do cabeçote é urgente.",
    category: "negative",
    probability: 0.08,
    financialImpact: -900,
    healthImpact: 0,
    happinessImpact: -15,
    cleanlinessImpact: 0,
    educationalTip: "Manter uma reserva de emergência ajuda a cobrir imprevistos como este sem precisar de empréstimos com juros altos."
  },
  {
    id: "fridge_repair",
    name: "Geladeira Queimou",
    description: "A geladeira parou de funcionar e os alimentos correm risco de estragar. Conserto imediato necessário.",
    category: "negative",
    probability: 0.07,
    financialImpact: -450,
    healthImpact: -5,
    happinessImpact: -12,
    cleanlinessImpact: 0,
    educationalTip: "Equipamentos domésticos quebram. Planejar compras parceladas ou usar a reserva de emergência são alternativas."
  },
  {
    id: "pipe_leak",
    name: "Vazamento no Banheiro",
    description: "Um cano estourou na parede do banheiro, molhando a casa e exigindo encanador de emergência.",
    category: "negative",
    probability: 0.09,
    financialImpact: -300,
    healthImpact: 0,
    happinessImpact: -8,
    cleanlinessImpact: -25, // Casa fica desorganizada/suja
    educationalTip: "Problemas na estrutura da casa reduzem a limpeza e o bem-estar da família. Resolva-os o quanto antes!"
  },
  {
    id: "medical_emergency",
    name: "Emergência Dentária",
    description: "Um membro da família teve uma forte dor de dente e precisou de canal de urgência fora do plano.",
    category: "negative",
    probability: 0.06,
    financialImpact: -600,
    healthImpact: -15,
    happinessImpact: -10,
    cleanlinessImpact: 0,
    educationalTip: "Gastos com saúde são prioridade máxima. Sem saúde, a produtividade e a felicidade caem drasticamente."
  },
  {
    id: "water_price_increase",
    name: "Bandeira Tarifária de Luz/Água",
    description: "A crise hídrica aumentou a tarifa de energia elétrica em 20% este mês.",
    category: "negative",
    probability: 0.12,
    financialImpact: -100, // Aumenta o custo fixo do mês
    healthImpact: 0,
    happinessImpact: -5,
    cleanlinessImpact: 0,
    educationalTip: "Fique atento ao consumo! Tomar banhos mais curtos e desligar aparelhos da tomada reduz o impacto de aumentos tarifários."
  },

  // Eventos Positivos
  {
    id: "work_bonus",
    name: "Bônus de Desempenho",
    description: "Seu trabalho na empresa rendeu uma bonificação de produtividade pelo excelente resultado do mês.",
    category: "positive",
    probability: 0.08,
    financialImpact: 700,
    healthImpact: 0,
    happinessImpact: 15,
    cleanlinessImpact: 0,
    educationalTip: "Dinheiro extra! O ideal é destinar parte dele para investimentos ou para a reserva de emergência, em vez de gastar tudo com desejos temporários."
  },
  {
    id: "cash_gift",
    name: "Presente de Aniversário",
    description: "Um parente distante enviou um presente em dinheiro para ajudar nas despesas da casa.",
    category: "positive",
    probability: 0.06,
    financialImpact: 250,
    healthImpact: 0,
    happinessImpact: 8,
    cleanlinessImpact: 0,
    educationalTip: "Valores inesperados ajudam a equilibrar o orçamento. Aproveite para quitar contas pequenas."
  },
  {
    id: "market_sale",
    name: "Super Promoção no Supermercado",
    description: "O mercado do bairro fez uma queima de estoque e você conseguiu economizar muito na compra mensal.",
    category: "positive",
    probability: 0.10,
    financialImpact: 150, // Economia que entra como saldo
    healthImpact: 5,
    happinessImpact: 8,
    cleanlinessImpact: 0,
    educationalTip: "Pesquisar preços e aproveitar promoções reais de itens necessários é uma excelente prática de economia doméstica."
  },
  {
    id: "energy_saving_award",
    name: "Prêmio de Consumo Consciente",
    description: "O condomínio/bairro premiou as residências que mais economizaram energia no último trimestre.",
    category: "positive",
    probability: 0.05,
    financialImpact: 200,
    healthImpact: 0,
    happinessImpact: 10,
    cleanlinessImpact: 5,
    educationalTip: "Economizar recursos protege o bolso e o planeta. Transforme a economia de luz e água em um hábito familiar."
  }
];

export const DEFAULT_TASKS = [
  {
    id: "clean_house",
    name: "Limpar a Casa",
    description: "Varrer, passar pano, tirar o pó e organizar os cômodos.",
    frequency: "Semanal",
    cleanlinessImpact: 15,
    healthImpact: 2,
    happinessImpact: 4,
    energyCost: 15, // Porcentagem de energia do participante por clique/ação
    cost: 15 // Custo de produtos de limpeza
  },
  {
    id: "wash_dishes",
    name: "Lavar a Louça",
    description: "Manter a pia limpa e organizada, evitando pragas.",
    frequency: "Diária",
    cleanlinessImpact: 8,
    healthImpact: 1,
    happinessImpact: 2,
    energyCost: 8,
    cost: 5
  },
  {
    id: "wash_clothes",
    name: "Lavar as Roupas",
    description: "Lavar, estender e passar as roupas da família.",
    frequency: "Semanal",
    cleanlinessImpact: 12,
    healthImpact: 0,
    happinessImpact: 5,
    energyCost: 12,
    cost: 20
  },
  {
    id: "exercise",
    name: "Praticar Exercícios",
    description: "Caminhada ou atividade física em família no parque.",
    frequency: "Livre",
    cleanlinessImpact: 0,
    healthImpact: 12,
    happinessImpact: 8,
    energyCost: 15,
    cost: 0
  },
  {
    id: "family_leisure",
    name: "Momento de Lazer em Família",
    description: "Assistir a um filme, jogar jogos de tabuleiro ou fazer um piquenique.",
    frequency: "Semanal",
    cleanlinessImpact: -2, // Bagunça um pouco a sala
    healthImpact: 2,
    happinessImpact: 18,
    energyCost: 10,
    cost: 30 // Custo do lanche ou atividade
  },
  {
    id: "prepare_meals",
    name: "Preparar Refeições Saudáveis",
    description: "Cozinhar comida caseira e saudável em vez de comprar comida pronta ou ultraprocessados.",
    frequency: "Diária",
    cleanlinessImpact: -4, // Suja panelas
    healthImpact: 10,
    happinessImpact: 6,
    energyCost: 10,
    cost: 25 // Custo dos ingredientes frescos
  }
];

export const DEFAULT_INVESTMENT_PRODUCTS = [
  {
    id: "poupanca",
    name: "Poupança",
    description: "A aplicação mais tradicional. Rendimento muito baixo, mas liquidez imediata e risco quase nulo.",
    monthlyYield: 0.005, // 0.5% ao mês
    risk: "Muito Baixo",
    minTerm: 0, // Sem prazo mínimo
    withdrawalPenalty: 0
  },
  {
    id: "cdb",
    name: "CDB (Certificado de Depósito Bancário)",
    description: "Rendimento superior à poupança. Risco baixo, garantido pelo FGC.",
    monthlyYield: 0.009, // 0.9% ao mês
    risk: "Baixo",
    minTerm: 1, // Pode resgatar no fechamento do mês seguinte
    withdrawalPenalty: 0.01 // 1% de multa se resgatar antes do prazo (se aplicável)
  },
  {
    id: "tesouro_direto",
    name: "Tesouro Selic",
    description: "Empréstimo para o governo federal. O investimento mais seguro do país, rendimento atrelado à taxa básica de juros.",
    monthlyYield: 0.01, // 1.0% ao mês
    risk: "Muito Baixo",
    minTerm: 0,
    withdrawalPenalty: 0
  },
  {
    id: "fundo_acoes",
    name: "Fundo de Ações Simples",
    description: "Investimento em empresas na Bolsa. Maior potencial de ganho, porém com risco de oscilação negativa.",
    monthlyYield: 0.018, // Média histórica de 1.8% ao mês, mas pode oscilar
    risk: "Médio-Alto",
    minTerm: 2,
    withdrawalPenalty: 0.03, // Multa de 3% se retirar antes do prazo
    isVariable: true // Indica que o rendimento pode variar ou até ser negativo
  }
];

export const PRECONFIGURED_FAMILIES = [
  {
    id: "pequena",
    name: "Família Jovem (Pequena)",
    adults: 2,
    teenagers: 0,
    children: 1,
    elderly: 0,
    description: "Pai, mãe e um bebê. Custos moderados de moradia, porém gastos elevados com fraldas e farmácia.",
    baseExpensesMultiplier: 0.8
  },
  {
    id: "padrao",
    name: "Família Padrão (Média)",
    adults: 2,
    teenagers: 1,
    children: 1,
    elderly: 0,
    description: "Pai, mãe, um adolescente de 14 anos e uma criança de 8 anos. Alto consumo de alimentação e despesas escolares.",
    baseExpensesMultiplier: 1.0
  },
  {
    id: "grande",
    name: "Família Numerosa (Grande)",
    adults: 2,
    teenagers: 2,
    children: 1,
    elderly: 1,
    description: "Avô, pais, dois adolescentes e uma criança pequena. Carga pesada de despesas com alimentação, moradia e saúde do idoso.",
    baseExpensesMultiplier: 1.4
  }
];

export const DEFAULT_CAMPAIGN_GOALS = [
  {
    id: "reserve_creator",
    name: "Criador de Reserva",
    description: "Criar uma Reserva de Emergência de pelo menos R$ 1.500.",
    points: 150,
    targetType: "reserve",
    targetValue: 1500
  },
  {
    id: "no_loans",
    name: "Sem Dívidas",
    description: "Concluir a simulação inteira sem contratar nenhum empréstimo bancário.",
    points: 200,
    targetType: "no_loans",
    targetValue: 0
  },
  {
    id: "healthy_family",
    name: "Família Saudável",
    description: "Manter o indicador de Saúde médio acima de 80% ao final da simulação.",
    points: 150,
    targetType: "health",
    targetValue: 80
  },
  {
    id: "happy_home",
    name: "Lar Feliz",
    description: "Manter o indicador de Felicidade médio acima de 85% ao final da simulação.",
    points: 150,
    targetType: "happiness",
    targetValue: 85
  },
  {
    id: "wise_investor",
    name: "Investidor Consciente",
    description: "Investir pelo menos R$ 1.000 em CDB ou Tesouro Selic.",
    points: 150,
    targetType: "investments",
    targetValue: 1000
  }
];
