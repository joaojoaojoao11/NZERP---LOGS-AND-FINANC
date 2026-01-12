
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FinanceService } from '../services/financeService';
import { DataService } from '../services/dataService';
import { AccountsReceivable, User, ARStagingItem } from '../types';
import { ICONS } from '../constants';
import Toast from './Toast';
import * as XLSX from 'xlsx';

const AccountsReceivableModule: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [data, setData] = useState<AccountsReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');

  // Estados de Importação
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStaging, setImportStaging] = useState<ARStagingItem[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const items = await FinanceService.getAccountsReceivable();
      setData(items);
    } catch (e) {
      setToast({ msg: 'Erro ao carregar títulos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      (item.cliente || '').toLowerCase().includes(term) ||
      (item.numero_documento || '').toLowerCase().includes(term) ||
      (item.id || '').toLowerCase().includes(term) ||
      (item.id_acordo || '').toLowerCase().includes(term) ||
      (item.origem || '').toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const downloadTemplate = () => {
    const headers = [
      "ID", "CLIENTE", "DATA_EMISSAO", "DATA_VENCIMENTO", "VALOR_DOCUMENTO", 
      "SALDO", "SITUACAO", "NUMERO_DOCUMENTO", "CATEGORIA", "HISTORICO", 
      "COMPETENCIA", "FORMA_PAGAMENTO", "VALOR_RECEBIDO"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Contas_Receber");
    XLSX.writeFile(wb, "Modelo_Importacao_OLIST.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const dataArray = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(dataArray, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (jsonData.length < 2) throw new Error("Planilha vazia ou sem dados.");

            const headers = (jsonData[0] as string[]).map(h => String(h).toLowerCase().trim());
            const rows = jsonData.slice(1);
            
            const parsedItems: AccountsReceivable[] = rows.map((row: any) => {
                const getVal = (keyPart: string) => {
                    const idx = headers.findIndex(h => h.includes(keyPart));
                    return idx !== -1 ? row[idx] : undefined;
                };

                const parseDate = (val: any) => {
                    if (!val) return '';
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    if (typeof val === 'string' && val.includes('/')) {
                        const parts = val.split('/');
                        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    return String(val);
                };

                const parseNum = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    return parseFloat(String(val).replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
                };

                return {
                    id: String(getVal('id') || `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`),
                    cliente: String(getVal('cliente') || '').toUpperCase(),
                    data_emissao: parseDate(getVal('emissao')),
                    data_vencimento: parseDate(getVal('vencimento')),
                    valor_documento: parseNum(getVal('valor_doc') || getVal('valor')),
                    saldo: parseNum(getVal('saldo')),
                    situacao: String(getVal('situacao') || 'ABERTO').toUpperCase(),
                    numero_documento: String(getVal('numero') || getVal('doc') || ''),
                    categoria: String(getVal('categoria') || '').toUpperCase(),
                    historico: String(getVal('historico') || ''),
                    competencia: String(getVal('competencia') || ''),
                    forma_pagamento: String(getVal('forma') || '').toUpperCase(),
                    valor_recebido: parseNum(getVal('recebido')),
                    origem: 'OLIST',
                    taxas: 0,
                    meio_recebimento: 'IMPORTADO',
                    numero_banco: ''
                } as AccountsReceivable;
            }).filter(i => i.cliente && i.valor_documento > 0);

            if (parsedItems.length === 0) throw new Error("Nenhum dado válido encontrado para importação.");

            const staging = await FinanceService.processARStaging(parsedItems);
            setImportStaging(staging);

        } catch (err: any) {
            setToast({ msg: `Erro na leitura: ${err.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = async () => {
      if (!importStaging) return;
      setIsProcessing(true);
      try {
          const res = await FinanceService.commitARBatch(importStaging, currentUser, 'Importação Olist');
          if (res.success) {
              setToast({ msg: 'IMPORTAÇÃO OLIST CONCLUÍDA!', type: 'success' });
              setImportStaging(null);
              setShowImportModal(false);
              await fetchData();
          } else {
              setToast({ msg: res.message || 'Erro ao salvar.', type: 'error' });
          }
      } catch (e) {
          setToast({ msg: 'Erro de comunicação.', type: 'error' });
      } finally {
          setIsProcessing(false);
      }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map(d => ({
        ID: d.id,
        ID_Acordo: d.id_acordo,
        Origem: d.origem,
        Cliente: d.cliente,
        Vencimento: d.data_vencimento,
        Valor: d.valor_documento,
        Saldo: d.saldo,
        Status: d.situacao,
        Doc: d.numero_documento
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ContasReceber");
    XLSX.writeFile(wb, "ContasReceber_NZERP.xlsx");
  };

  if (loading) return <div className="p-20 text-center opacity-30 font-black uppercase text-xs italic animate-pulse">Carregando Títulos...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 flex flex-col h-full">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Contas a Receber</h2>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mt-2 italic">
            Controle Financeiro Centralizado
          </p>
        </div>
        
        <div className="flex gap-3">
           <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 md:w-80">
              <input 
                type="text" 
                placeholder="BUSCAR CLIENTE, ORIGEM OU DOC..." 
                className="w-full px-4 py-2 bg-transparent outline-none font-bold text-xs uppercase"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button 
             onClick={exportExcel}
             className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center space-x-2 italic"
           >
              <ICONS.Upload className="w-3.5 h-3.5 rotate-180" />
              <span>Exportar</span>
           </button>
           <button 
             onClick={() => setShowImportModal(true)} 
             className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all flex items-center space-x-2 italic"
           >
             <ICONS.Upload className="w-3.5 h-3.5" />
             <span>Importar OLIST</span>
           </button>
        </div>
      </div>

      <div className="table-container flex-1 overflow-auto border border-slate-200 rounded-[2rem] bg-white shadow-sm" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full border-separate border-spacing-0" style={{ minWidth: '1600px' }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="bg-slate-900 text-slate-400 px-6 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left sticky left-0 z-30 w-32">ID LANÇAMENTO</th>
              <th className="bg-slate-900 text-slate-400 px-6 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left">ID ACORDO</th>
              <th className="bg-slate-900 text-slate-400 px-6 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left">Origem</th>
              <th className="bg-slate-900 text-slate-400 px-6 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left">Cliente</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-center">Vencimento</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-right">Valor Doc.</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-right">Saldo</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-center">Situação</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left">Nº Doc</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-left">Forma Pgto</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-center">Cobrável</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-center">Liquidação</th>
              <th className="bg-slate-900 text-slate-400 px-4 py-5 text-[9px] font-black uppercase border-b border-slate-800 text-right">Recebido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map(item => {
              const isOverdue = item.data_vencimento && new Date(item.data_vencimento) < new Date() && item.saldo > 0.01;
              const isPaid = item.saldo <= 0.01 || item.situacao === 'PAGO';
              
              // Regras de Visualização Condicional
              // 1. Se for parcela gerada (Origem NZERP + Tem ID Acordo), oculta ID Lançamento
              const isParcelaAcordo = item.origem === 'NZERP' && !!item.id_acordo;
              
              // 2. Se for título negociado (Situação NEGOCIADO), oculta ID Acordo
              const isTituloNegociado = item.situacao === 'NEGOCIADO';

              return (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 border-b border-slate-100 sticky left-0 z-20 bg-white group-hover:bg-slate-50 w-32 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {!isParcelaAcordo && (
                        <span className="font-black text-slate-400 text-[10px] italic">#{item.id}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 border-b border-slate-100">
                    {!isTituloNegociado && item.id_acordo ? (
                        <span className="text-[10px] font-bold text-purple-600">#{item.id_acordo}</span>
                    ) : (
                        <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-3 border-b border-slate-100">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${
                        item.origem === 'NZERP' 
                        ? 'bg-purple-50 text-purple-600 border-purple-100' 
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                        {item.origem || '---'}
                    </span>
                  </td>
                  <td className="px-6 py-3 border-b border-slate-100 font-black text-slate-900 uppercase text-[11px] whitespace-nowrap">
                    {item.cliente}
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 text-center font-bold text-[11px] ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                    {item.data_vencimento ? item.data_vencimento.split('-').reverse().join('/') : '-'}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 text-right font-bold text-slate-500 text-[11px]">
                    {item.valor_documento?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 text-right font-black text-slate-900 text-[11px]">
                    {item.saldo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 text-center">
                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                       isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                       isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 
                       'bg-amber-50 text-amber-600 border-amber-100'
                     }`}>
                        {isOverdue ? 'VENCIDO' : item.situacao}
                     </span>
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 font-bold text-[10px] text-slate-600 uppercase">{item.numero_documento}</td>
                  <td className="px-4 py-3 border-b border-slate-100 font-bold text-[10px] text-slate-500 uppercase">{item.forma_pagamento}</td>
                  <td className="px-4 py-3 border-b border-slate-100 text-center">
                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border ${
                        item.statusCobranca === 'NAO_COBRAVEL' 
                        ? 'bg-slate-50 text-slate-400 border-slate-200' 
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                        {item.statusCobranca === 'NAO_COBRAVEL' ? 'NÃO' : 'SIM'}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 text-center text-[10px] text-slate-400 font-bold">
                    {item.data_liquidacao ? item.data_liquidacao.split('-').reverse().join('/') : '-'}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 text-right font-bold text-emerald-600 text-[11px]">
                    {item.valor_recebido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
            <div className="py-20 text-center opacity-30 font-black uppercase text-[10px]">Nenhum título encontrado.</div>
        )}
      </div>

      {/* --- MODAL DE IMPORTAÇÃO --- */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white max-w-6xl w-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh]">
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 shrink-0">
                 <div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
                       {importStaging ? 'Revisão de Carga OLIST' : 'Importação OLIST'}
                    </h3>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Sincronização em Massa</p>
                 </div>
                 <button onClick={() => { setShowImportModal(false); setImportStaging(null); }} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><ICONS.Add className="w-6 h-6 rotate-45" /></button>
              </div>
              
              {!importStaging ? (
                <div className="p-12 text-center space-y-8 flex-1 flex flex-col justify-center">
                   <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><ICONS.Upload className="w-12 h-12" /></div>
                   <div className="max-w-xl mx-auto">
                      <p className="text-slate-500 font-medium text-sm mb-8">Importe os títulos da Olist. Todos os registros serão marcados automaticamente com origem OLIST.</p>
                      <div className="flex gap-4 justify-center">
                         <button onClick={downloadTemplate} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center space-x-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span>Baixar Modelo</span>
                         </button>
                         <button onClick={() => fileInputRef.current?.click()} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center space-x-3">
                            <ICONS.Upload className="w-4 h-4" />
                            <span>Selecionar Planilha</span>
                         </button>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
                   </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                   <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest sticky top-0 z-10">
                            <tr>
                               <th className="px-6 py-4">Status</th>
                               <th className="px-6 py-4">Origem</th>
                               <th className="px-6 py-4">Cliente / ID</th>
                               <th className="px-6 py-4 text-center">Vencimento</th>
                               <th className="px-6 py-4 text-right">Valor</th>
                               <th className="px-6 py-4 text-right">Saldo</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 text-[11px]">
                            {importStaging.map((item, idx) => (
                               <tr key={idx} className={`hover:bg-blue-50/30 transition-all ${item.status === 'NEW' ? 'bg-emerald-50/30' : item.status === 'CHANGED' ? 'bg-blue-50/30' : ''}`}>
                                  <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${
                                        item.status === 'NEW' ? 'bg-emerald-100 text-emerald-700' : 
                                        item.status === 'CHANGED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                     }`}>{item.status === 'NEW' ? 'NOVO' : item.status === 'CHANGED' ? 'ALTERADO' : 'IGUAL'}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black border border-blue-100">OLIST</span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <p className="font-black text-slate-900">{item.data.cliente}</p>
                                     <p className="text-[9px] text-slate-400 uppercase truncate max-w-[200px]">ID: {item.data.id}</p>
                                  </td>
                                  <td className="px-6 py-4 text-center font-bold text-slate-500">{item.data.data_vencimento || '-'}</td>
                                  <td className="px-6 py-4 text-right font-black text-slate-900">R$ {item.data.valor_documento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-6 py-4 text-right font-bold text-slate-400">R$ {item.data.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                   <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo OLIST</p>
                         <p className="text-xl font-black text-slate-900 uppercase italic">
                            {importStaging.filter(i => i.status === 'NEW').length} Novos • {importStaging.filter(i => i.status === 'CHANGED').length} Atualizados
                         </p>
                      </div>
                      <div className="flex gap-4">
                         <button onClick={() => setImportStaging(null)} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black text-[9px] uppercase rounded-2xl hover:text-red-500 transition-all">Cancelar</button>
                         <button onClick={confirmImport} disabled={isProcessing} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-500 transition-all">
                            {isProcessing ? 'Gravando...' : 'Confirmar Carga'}
                         </button>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivableModule;
