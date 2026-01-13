

export type UserRole = 'DIRETORIA' | 'ADM' | 'ESTOQUISTA';
export type ModuleContext = 'ESTOQUE' | 'FINANCEIRO' | null;

export type ViewType = 
  | 'SELECAO_MODULO' 
  | 'INVENTARIO' 
  | 'CONFERENCIA_INVENTARIO' 
  | 'HISTORICO_HUB' 
  | 'ENTRADA' 
  | 'SAIDA' 
  | 'CATALOGO_MESTRE' 
  | 'GESTAO_USUARIOS' 
  | 'LANCAMENTO_RECEBER'
  | 'INADIMPLENCIA' 
  | 'CONTAS_PAGAR'
  | 'BI_CAIXA' 
  | 'BI_DESPESAS'
  | 'BI_ESTOQUE' // Novo Módulo
  | 'CONFIGURACOES'
  | 'MOVEMENTS_LIST';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  active: boolean;
  permissions?: string[]; 
}

export enum WithdrawalReason {
  VENDA = 'Venda',
  TROCA = 'Troca',
  DEFEITO = 'Defeito',
  AJUSTE = 'Ajuste',
  AUDITORIA = 'Auditoria'
}

export interface StockItem {
  lpn: string;
  sku: string;
  nome: string;
  categoria: string;
  marca: string;
  fornecedor: string;
  lote: string;
  nfControle?: string;
  larguraL: number;
  quantMl: number;
  custoUnitario: number;
  coluna: string;
  prateleira: string;
  nCaixa?: string;
  statusRolo: string;
  observacao?: string;
  dataEntrada: string;
  ultAtuali: string;
  responsavel: string;
  motivoEntrada?: string;
  metragemPadrao?: number;
  estoqueMinimo?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  usuario: string;
  acao: string;
  sku?: string;
  lpn?: string;
  quantidade?: number;
  detalhes: string;
  lote?: string;
  nome?: string;
  valorOperacao?: number; 
  nfControle?: string;
  tipo?: string;
  categoria?: string;
  cliente?: string;
  motivo?: string;
  dataPedidoFornecedor?: string;
}

export interface MasterProduct {
  sku: string;
  nome: string;
  categoria: string;
  marca?: string;
  fornecedor?: string;
  larguraL?: number;
  metragemPadrao?: number;
  estoqueMinimo: number;
  custoUnitario?: number;
  precoVenda?: number; 
}

export interface CompanySettings {
  name: string;
  cnpj: string;
  address: string;
  logoUrl: string;
}

export interface InventoryUpdateStaging {
  item: Partial<StockItem>;
  status: 'NEW' | 'CHANGED' | 'DELETED' | 'UNCHANGED';
  diff?: string[];
}

export interface InventorySession {
  id: string;
  startTime: string;
  endTime?: string;
  responsible: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  itemsCount: number;
  posAdjustments: number;
  negAdjustments: number;
  observation?: string;
  durationSeconds?: number;
}

export interface AppNotification {
  id: string;
  titulo: string;
  mensagem: string;
  timestamp: string;
  lida: boolean;
  clienteTarget?: string;
}

export interface WarehouseLayout {
  columns: string[];
  shelvesPerColumn: Record<string, string[]>;
}

export interface AccountsPayable {
  id: string;
  fornecedor: string;
  dataEmissao: string;
  dataVencimento: string;
  dataLiquidacao: string;
  valorDocumento: number;
  saldo: number;
  situacao: string;
  numeroDocumento: string;
  categoria: string;
  historico: string;
  valorPago: number;
  competencia: string;
  formaPagamento: string;
  chavePixBoleto: string;
}

export interface APStagingItem {
  data: AccountsPayable;
  status: 'NEW' | 'CHANGED' | 'UNCHANGED';
  diff?: string[];
}

export interface ARStagingItem {
  data: AccountsReceivable;
  status: 'NEW' | 'CHANGED' | 'UNCHANGED';
  diff?: string[];
}

export interface Settlement {
  id: string;
  cliente: string;
  valorOriginal: number;
  valorAcordo: number;
  parcelas: number;
  intervaloDias: number;
  frequencia: 'Semanal' | 'Quinzenal' | 'Mensal';
  dataPrimeiraParcela: string;
  dataCriacao: string;
  status: 'ATIVO' | 'FINALIZADO' | 'LIQUIDADO' | 'CANCELADO';
  usuario: string;
  observacao?: string;
  titulosNegociados?: string[]; 
}

// Atualizado estritamente conforme solicitado
export interface AccountsReceivable {
  id: string;
  cliente: string;
  data_emissao: string;
  data_vencimento: string;
  data_liquidacao?: string | null;
  data_recebimento?: string | null;
  valor_documento: number;
  saldo: number;
  situacao: string;
  numero_documento: string;
  numero_banco?: string;
  categoria: string;
  historico: string;
  competencia: string;
  forma_pagamento: string;
  meio_recebimento: string;
  taxas: number;
  valor_recebido: number;
  valor_recebido_csv?: number;
  // Campos de sistema (opcionais para exibição mas nao salvos diretamente se nao existirem na tabela)
  origem?: string;
  id_acordo?: string;
  statusCobranca?: string;
}

export interface DebtorInfo {
  cliente: string;
  totalVencido: number;
  vencidoAte15d: number;
  vencidoMais15d: number;
  enviarCartorio: number;
  qtdTitulos: number;
  statusCobranca: string;
  protocoloAtual: string;
  enviadoCartorio: boolean;
  nextActionDate?: string; // Data da próxima ação agendada (se houver)
}

export interface PaymentGroup {
  bank: string;
  method: string;
  count: number;
  totalValue: number;
  totalFees: number;
}

export interface MonthlySummary {
  monthYear: string; 
  totalValue: number;
  groups: PaymentGroup[]; 
}

export interface ImportSummary {
  processedAt: string;
  fileName: string;
  user: string;
  totalGlobal: number;
  totalFeesGlobal: number;
  monthlyBreakdown: MonthlySummary[];
}

export interface FinancialImportRecord {
  id: string;
  timestamp: string;
  usuario: string;
  resumo: ImportSummary;
  nome_arquivo?: string;
}

export interface ApprovalCase {
  id: string;
  timestamp: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  sku: string;
  motivo: string;
  lpn?: string;
  solicitante: string;
  cliente?: string;
  quantidade: number;
  pedido?: string;
  aprovador?: string;
  parecer?: string;
}

export interface InboundRequest {
  id: string;
  timestamp: string;
  solicitante: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  items: Partial<StockItem>[];
  aprovador?: string;
  relato?: string;
}

export interface CollectionHistory {
  id: string;
  cliente: string;
  data_registro: string;
  dias_atraso: number;
  valor_devido: number;
  acao_tomada: string;
  data_proxima_acao?: string;
  observacao?: string;
  usuario: string;
}