import { supabaseClient as supabase } from './core';
import { InventoryService } from './inventoryService';
import { FinanceService } from './financeService';
import { UserService } from './userService';
import { 
  StockItem, AuditLog, User, MasterProduct, CompanySettings, 
  InventoryUpdateStaging, InventorySession, AccountsReceivable, 
  DebtorInfo, WarehouseLayout, ApprovalCase, InboundRequest, 
  AccountsPayable, Settlement, APStagingItem, ARStagingItem 
} from '../types';

export class DataService {
  static async getInventory() { return InventoryService.getInventory(); }
  static async updateStockItem(item: StockItem, user: User) { return InventoryService.updateStockItem(item, user); }
  static async saveInventory(items: StockItem[]) { return InventoryService.saveInventory(items); }
  static async getLogs() { return InventoryService.getLogs(); }
  static async getLogsByLpn(lpn: string) { return InventoryService.getLogsByLpn(lpn); }
  
  static async addLog(user: User, action: string, sku: string = '', lpn: string = '', qty: number = 0, details: string, lote?: string, name?: string, valorOperacao?: number, nfControle?: string, tipo: string = 'LOGISTICA', category?: string, motivo?: string, cliente?: string) {
    return InventoryService.addLog(user, action, sku, lpn, qty, details, lote, name, valorOperacao, nfControle, tipo, category, motivo, cliente);
  }
  static async getLayout() { return InventoryService.getLayout(); }
  static async saveLayout(layout: WarehouseLayout) { return InventoryService.saveLayout(layout); }
  static async getInventorySessions() { return InventoryService.getInventorySessions(); }
  static async saveInventorySession(session: InventorySession) { return InventoryService.saveInventorySession(session); }
  
  static async commitInventoryBatch(staging: InventoryUpdateStaging[], user: User) {
    return InventoryService.commitInventoryBatch(staging, user);
  }

  static async addProduct(item: any, user: User) { return InventoryService.addProduct(item, user); }
  static async processInboundBatch(items: StockItem[], user: User, fileName?: string) {
    const res = await InventoryService.processInboundBatchAtomic(items, user);
    if (res.success && fileName) {
      await FinanceService.saveFinancialLog(user, 'IMPORTACAO_ESTOQUE', 'N/A', `Importação: ${fileName}`, items.length);
    }
    return res;
  }

  static async getInboundRequests(): Promise<InboundRequest[]> {
    const { data, error } = await supabase.from('inbound_requests').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return data;
  }

  static async processInboundRequest(id: string, action: 'APROVAR' | 'RECUSAR', admin: User, relato: string, costs: Record<string, number>) {
    const { data: request, error: fetchErr } = await supabase.from('inbound_requests').select('*').eq('id', id).single();
    if (fetchErr) throw fetchErr;

    if (action === 'APROVAR' && request.items) {
      const itemsToProcess = request.items.map((it: any, idx: number) => ({
        ...it,
        custoUnitario: costs[`${it.sku}_${idx}`] || it.custoUnitario || 0
      }));
      await InventoryService.processInboundBatchAtomic(itemsToProcess, admin);
    }

    const { error } = await supabase.from('inbound_requests').update({ 
      status: action === 'APROVAR' ? 'APROVADO' : 'RECUSADO', 
      aprovador: admin.name, 
      relato: relato 
    }).eq('id', id);
    
    return !error;
  }

  static async getNextLPN() { return InventoryService.getNextLPN(); }
  static async processInventoryUpdateStaging(items: any[]) { return InventoryService.processInventoryUpdateStaging(items); }

  static async getMasterCatalog(): Promise<MasterProduct[]> {
    const { data, error } = await supabase.from('master_catalog').select('*').order('sku', { ascending: true });
    if (error) throw error; 
    return data.map(p => ({
      sku: p.sku,
      nome: p.nome,
      categoria: p.categoria,
      marca: p.marca,
      fornecedor: p.fornecedor,
      larguraL: Number(p.larguraL ?? p.largura_l ?? 1.52), 
      metragemPadrao: Number(p.metragemPadrao ?? p.metragem_padrao ?? 15),
      estoqueMinimo: Number(p.estoqueMinimo ?? p.estoque_minimo ?? 0), 
      custoUnitario: Number(p.custoUnitario ?? p.custo_unitario ?? 0), 
      precoVenda: Number(p.precoVenda ?? p.preco_venda ?? 0)
    }));
  }

  static async updateMasterProduct(product: MasterProduct, user: User, oldSku: string): Promise<boolean> {
    const { error } = await supabase.from('master_catalog').update({
      sku: product.sku,
      nome: product.nome, 
      categoria: product.categoria, 
      marca: product.marca, 
      fornecedor: product.fornecedor,
      largura_l: Number(product.larguraL), 
      metragem_padrao: Number(product.metragemPadrao), 
      estoque_minimo: Number(product.estoqueMinimo), 
      custo_unitario: Number(product.custoUnitario), 
      preco_venda: Number(product.precoVenda)
    }).eq('sku', oldSku);
    
    if (error) throw error;
    return true;
  }

  static async importMasterProducts(items: MasterProduct[], user: User) {
    return InventoryService.importMasterProducts(items);
  }

  static async getAccountsReceivable() { return FinanceService.getAccountsReceivable(); }
  static async getAccountsPayable() { return FinanceService.getAccountsPayable(); }

  static async processAPStaging(items: AccountsPayable[]): Promise<APStagingItem[]> {
    return FinanceService.processAPStaging(items);
  }

  static async commitAPBatch(staging: APStagingItem[], user: User) {
    return FinanceService.commitAPBatch(staging, user);
  }

  static async login(email: string, pass: string) { return UserService.login(email, pass); }
  static async getUsers() { return UserService.getUsers(); }
  static async saveUser(user: User, admin: User) { return UserService.saveUser(user); }
  static async deleteUser(id: string, admin: User) { 
    const { error } = await supabase.from('users').delete().eq('id', id);
    return !error;
  }
  static async getCompanySettings() { return UserService.getCompanySettings(); }
  static async saveCompanySettings(settings: CompanySettings) { return UserService.saveCompanySettings(settings); }

  static async registerWithdrawalBatch(items: any[], user: User) {
    return InventoryService.processWithdrawalBatchAtomic(items, user);
  }

  static async isOrderIdUsed(orderId: string): Promise<boolean> {
    const { data } = await supabase.from('audit_logs').select('id').eq('nfControle', orderId).limit(1);
    return !!data && data.length > 0;
  }

  static async setAuditLock(lock: any): Promise<void> { }

  static async getDebtorsSummary(): Promise<DebtorInfo[]> {
    const [ar, { data: historyData }] = await Promise.all([
      this.getAccountsReceivable(),
      supabase.from('collection_history').select('cliente, data_proxima_acao').order('data_registro', { ascending: false })
    ]);
  
    const nextActionMap: Record<string, string> = {};
    if (historyData) {
      historyData.forEach((h: any) => {
        if (!nextActionMap[h.cliente] && h.data_proxima_acao) {
          nextActionMap[h.cliente] = h.data_proxima_acao;
        }
      });
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const debtorsMap: Record<string, DebtorInfo> = {};
  
    ar.forEach(t => {
      const situacao = (t.situacao || '').toUpperCase().trim();
      const isDebtActiveAndOverdue = 
          !['CANCELADO', 'PAGO', 'LIQUIDADO', 'NEGOCIADO'].includes(situacao) &&
          t.saldo > 0.01 &&
          !t.id_acordo &&
          t.data_vencimento && new Date(t.data_vencimento) < today;
  
      if (!isDebtActiveAndOverdue) return;
  
      const dueDate = new Date(t.data_vencimento!);
  
      if (!debtorsMap[t.cliente]) {
        debtorsMap[t.cliente] = {
          cliente: t.cliente,
          totalVencido: 0,
          vencidoAte15d: 0,
          vencidoMais15d: 0,
          enviarCartorio: 0,
          qtdTitulos: 0,
          statusCobranca: 'PENDENTE',
          protocoloAtual: `COB-${Date.now().toString().slice(-6)}`,
          enviadoCartorio: false,
          nextActionDate: nextActionMap[t.cliente]
        };
      }
  
      const info = debtorsMap[t.cliente];
      info.totalVencido += t.saldo;
      info.qtdTitulos += 1;
  
      if (t.statusCobranca === 'CARTORIO') {
        info.enviarCartorio += t.saldo;
        info.enviadoCartorio = true;
      } else {
        const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 15) {
          info.vencidoAte15d += t.saldo;
        } else {
          info.vencidoMais15d += t.saldo;
        }
      }
    });
  
    return Object.values(debtorsMap).sort((a, b) => b.totalVencido - a.totalVencido);
  }

  static async sendToNotary(cliente: string, user: User): Promise<boolean> {
    return true; 
  }

  static async getApprovalCases() {
    const { data, error } = await supabase.from('approval_cases').select('*').order('timestamp', { ascending: false });
    if (error) throw error; 
    return data;
  }

  static async processCase(id: string, action: 'APROVAR' | 'RECUSAR', admin: User, relato: string) {
    const { error } = await supabase.from('approval_cases').update({ status: action === 'APROVAR' ? 'APROVADO' : 'RECUSADO', aprovador: admin.name, parecer: relato }).eq('id', id);
    if (error) throw error; 
    return { success: !error, message: error?.message };
  }
}