
import React, { useMemo } from 'react';
import { ScreenshotState, OcrTradeCandidate, Trade, PositionType } from '../types';

interface OcrImportModalProps {
  onClose: () => void;
  onImport: (trades: Trade[]) => void;
  brokers: string[];
  screenshots: ScreenshotState[];
  isProcessing: boolean;
  onUpdateScreenshots: (updater: (prev: ScreenshotState[]) => ScreenshotState[]) => void;
  onStartOcr: (files: File[]) => void;
}

const OcrImportModal: React.FC<OcrImportModalProps> = ({ 
  onClose, onImport, brokers, 
  screenshots, isProcessing, onUpdateScreenshots, onStartOcr 
}) => {
  const hasImages = screenshots.length > 0;
  const step = (hasImages && (screenshots.some(s => s.status === 'ready' || s.status === 'failed') || isProcessing)) ? 'confirm' : 'upload';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10) as File[];
    if (files.length > 0) onStartOcr(files);
  };

  const handleConfirmImport = () => {
    const allTrades: Trade[] = [];
    screenshots.forEach(s => {
      s.candidates.forEach(c => {
        if (!c.stockName) return;
        allTrades.push({
          id: Date.now() + Math.random(),
          positionType: c.positionType,
          stockName: c.stockName.toUpperCase(),
          broker: c.broker || undefined,
          openDate: c.openDate,
          openPrice: c.openPrice,
          totalQuantity: c.totalQuantity,
          remainingQuantity: c.totalQuantity,
          status: 'open',
          expiryDate: c.expiryDate,
          strikePrice: c.strikePrice,
          closeTransactions: []
        });
      });
    });
    onImport(allTrades);
    onClose();
  };

  const removeScreenshot = (sIdx: number) => {
    onUpdateScreenshots(prev => prev.filter((_, idx) => idx !== sIdx));
  };

  const clearFailedScreenshots = () => {
    onUpdateScreenshots(prev => prev.filter(s => s.status !== 'failed'));
  };

  const updateCandidate = (sIdx: number, cIdx: number, updates: Partial<OcrTradeCandidate>) => {
    onUpdateScreenshots(prev => prev.map((s, idx) => {
      if (idx !== sIdx) return s;
      const newCands = [...s.candidates];
      newCands[cIdx] = { ...newCands[cIdx], ...updates };
      return { ...s, candidates: newCands };
    }));
  };

  const removeCandidate = (sIdx: number, cIdx: number) => {
    onUpdateScreenshots(prev => prev.map((s, idx) => {
      if (idx !== sIdx) return s;
      const newCands = [...s.candidates];
      newCands.splice(cIdx, 1);
      return { ...s, candidates: newCands };
    }));
  };

  const totalCandidates = useMemo(() => 
    screenshots.reduce((acc, s) => acc + s.candidates.length, 0), 
  [screenshots]);

  const failedCount = useMemo(() => 
    screenshots.filter(s => s.status === 'failed').length,
  [screenshots]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
        <div className={`px-6 py-4 border-b flex justify-between items-center rounded-t-[2rem] bg-indigo-600 text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <i className={`fa-solid ${isProcessing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none">
                {isProcessing ? '正在后台批量识别...' : 'AI 智能批量录入'}
              </h2>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1">
                {isProcessing ? '您可以保持窗口开启，后台正在解析截图' : `当前已加载: ${screenshots.length} 张图片`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30">
          {step === 'upload' ? (
            <div className="max-w-xl mx-auto space-y-8 h-full flex flex-col pt-10">
              <label className={`border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg bg-indigo-500 text-white`}>
                  <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-slate-700">导入持仓/交易详情截图</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-bold italic">支持富途、老虎、嘉信、IB 等主流券商截图</p>
                </div>
                <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                {screenshots.map((s, sIdx) => (
                  <div key={sIdx} className={`group relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 shadow-sm transition-all ${s.status === 'processing' ? 'border-indigo-400 animate-pulse' : s.status === 'failed' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-white'}`}>
                    <img src={s.preview} className="w-full h-full object-cover" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeScreenshot(sIdx); }}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg border-2 border-white"
                      title="移除"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                    {s.status === 'processing' && (
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
                        <i className="fa-solid fa-gear fa-spin text-white"></i>
                      </div>
                    )}
                    {s.status === 'failed' && (
                      <div className="absolute inset-0 bg-rose-500/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
                        <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                        <span className="text-[8px] font-black uppercase tracking-tighter mt-1">解析失败</span>
                      </div>
                    )}
                    {s.status === 'ready' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-0.5 text-center">
                        <span className="text-[8px] font-black text-white uppercase">{s.candidates.length} 项</span>
                      </div>
                    )}
                  </div>
                ))}
                {failedCount > 0 && (
                  <button onClick={clearFailedScreenshots} className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 text-rose-500 hover:bg-rose-100 transition-colors">
                    <i className="fa-solid fa-broom text-xs mb-1"></i>
                    <span className="text-[9px] font-black uppercase text-center leading-tight px-1">清除失败项</span>
                  </button>
                )}
                <label className="flex-shrink-0 flex items-center justify-center w-20 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer">
                  <i className="fa-solid fa-plus"></i>
                  <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-2 py-4 whitespace-nowrap w-px">交易类型</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">标的代码</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">成交均价</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">数量</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">到期日 (YYMMDD)</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">行权价</th>
                        <th className="px-2 py-4 whitespace-nowrap w-px">账户/券商</th>
                        <th className="px-2 py-4 text-center whitespace-nowrap">管理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {screenshots.map((s, sIdx) => (
                        s.candidates.map((c, cIdx) => {
                          const isOption = c.positionType.includes('Call') || c.positionType.includes('Put');
                          return (
                            <tr key={`${sIdx}-${cIdx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-2 py-3 whitespace-nowrap">
                                <select 
                                  value={c.positionType} 
                                  onChange={e => updateCandidate(sIdx, cIdx, { positionType: e.target.value as PositionType })} 
                                  className={`w-full text-[10px] font-black rounded-lg p-2 border-0 outline-none uppercase ${isOption ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}
                                >
                                  <option value={PositionType.BUY_STOCK}>Buy Stock (买入股票)</option>
                                  <option value={PositionType.SELL_STOCK}>Sell Stock (卖出股票)</option>
                                  <option value={PositionType.LONG_CALL}>Long Call (买入看涨)</option>
                                  <option value={PositionType.SHORT_CALL}>Short Call (卖出看涨)</option>
                                  <option value={PositionType.LONG_PUT}>Long Put (买入看跌)</option>
                                  <option value={PositionType.SHORT_PUT}>Short Put (卖出看跌)</option>
                                </select>
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                <input type="text" value={c.stockName} onChange={e => updateCandidate(sIdx, cIdx, { stockName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black uppercase outline-none" />
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                <input type="number" step="0.0001" value={c.openPrice} onChange={e => updateCandidate(sIdx, cIdx, { openPrice: parseFloat(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-slate-900 outline-none" />
                              </td>
                              <td className="px-2 py-3 w-24 whitespace-nowrap">
                                <input type="number" value={c.totalQuantity} onChange={e => updateCandidate(sIdx, cIdx, { totalQuantity: parseInt(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-slate-900 outline-none" />
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                {isOption ? <input type="date" value={c.expiryDate || ""} onChange={e => updateCandidate(sIdx, cIdx, { expiryDate: e.target.value })} className="w-full bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-sm font-black text-slate-900 outline-none" /> : <span className="text-slate-300 text-xs flex justify-center">--</span>}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                {isOption ? <input type="number" step="0.5" value={c.strikePrice || ""} onChange={e => updateCandidate(sIdx, cIdx, { strikePrice: parseFloat(e.target.value) })} className="w-full bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-sm font-black text-slate-900 outline-none" /> : <span className="text-slate-300 text-xs flex justify-center">--</span>}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                <select value={c.broker} onChange={e => updateCandidate(sIdx, cIdx, { broker: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none">
                                  <option value="">默认账户</option>
                                  {brokers.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button onClick={() => removeCandidate(sIdx, cIdx)} className="w-8 h-8 rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"><i className="fa-solid fa-trash-can text-xs"></i></button>
                              </td>
                            </tr>
                          );
                        })
                      ))}
                    </tbody>
                  </table>
                </div>
                {isProcessing && screenshots.filter(s => s.status === 'processing').length > 0 && (
                  <div className="p-12 text-center bg-slate-50/30 border-t border-slate-100">
                    <i className="fa-solid fa-microchip fa-spin text-4xl text-indigo-500 mb-4"></i>
                    <p className="text-slate-600 text-sm font-black animate-pulse uppercase tracking-widest">
                      AI 正在解析余下 {screenshots.filter(s => s.status === 'processing').length} 张图片...
                    </p>
                  </div>
                )}
                {totalCandidates === 0 && !isProcessing && (
                  <div className="p-20 text-center">
                     <i className="fa-solid fa-magnifying-glass-chart text-4xl text-slate-200 mb-4"></i>
                     <p className="text-slate-400 text-sm font-bold">暂未提取到数据，请上传清晰的交易单截图</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between rounded-b-[2rem]">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-4">
             {isProcessing ? (
               <span className="flex items-center gap-2"><i className="fa-solid fa-spinner fa-spin"></i> 正在解析中...</span>
             ) : step === 'confirm' ? (
               <>
                 <span>加载图片: {screenshots.length}</span>
                 <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                 <span className="text-indigo-600">提取交易项: {totalCandidates} 条</span>
               </>
             ) : '请选择成交截图文件'}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {isProcessing ? (
               <button onClick={onClose} className="px-10 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all w-full sm:w-auto">关闭并后台解析</button>
            ) : (
              <>
                {step === 'confirm' && (
                  <button onClick={handleConfirmImport} disabled={totalCandidates === 0} className={`flex-1 sm:flex-none px-12 py-4 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${totalCandidates === 0 ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}>
                    <i className="fa-solid fa-check-double"></i> 确认并录入
                  </button>
                )}
                <button onClick={onClose} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl w-full sm:w-auto hover:bg-slate-50 transition-colors">取消</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrImportModal;
