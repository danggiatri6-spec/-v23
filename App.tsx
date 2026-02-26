
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PositionType, 
  Trade, 
  StockHolding, 
  PortfolioData, 
  UserProfile,
  ScreenshotState,
  AiProviderConfig
} from './types';
import { analyzePortfolio } from './services/geminiService';
import { performAiOcr } from './services/ocrService';
import { fetchLatestPrices, MarketUpdate } from './services/marketService';
import TradeForm from './components/TradeForm';
import OpenPositions from './components/OpenPositions';
import ClosedLog from './components/ClosedLog';
import DataManagement from './components/DataManagement';
import UserSelector from './components/UserSelector';
import OcrImportModal from './components/OcrImportModal';

const PROFILES_KEY = 'wealthtrack_pro_v23_profiles';
const ACTIVE_PROFILE_ID_KEY = 'wealthtrack_active_profile_id';
const AI_CONFIG_KEY = 'wealthtrack_ai_config';
const DEFAULT_PROFILE: UserProfile = { id: 'default', name: '默认账户', avatarColor: 'bg-indigo-500' };

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'add' | 'data'>('open');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stockPortfolio, setStockPortfolio] = useState<Record<string, StockHolding>>({});
  const [brokers, setBrokers] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasNewAnalysis, setHasNewAnalysis] = useState(false);
  
  const [marketUpdate, setMarketUpdate] = useState<MarketUpdate>({ prices: {}, sources: [] });
  const [isSyncingMarket, setIsSyncingMarket] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [globalScreenshots, setGlobalScreenshots] = useState<ScreenshotState[]>([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [hasOcrResults, setHasOcrResults] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>(new Date().toLocaleTimeString());
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>({
    mode: 'qwen', 
    qwenApiKey: 'sk-9259ee02978745e394c13f15e5381e41',
    qwenModel: 'qwen-vl-plus',
    qwenEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  });

  const [needsKeySelection, setNeedsKeySelection] = useState<boolean>(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem(AI_CONFIG_KEY);
    if (savedConfig) {
      try { 
        const parsed = JSON.parse(savedConfig);
        // 强制确保 mode 存在，如果不存在则默认为 qwen
        setAiConfig({ ...aiConfig, ...parsed, mode: parsed.mode || 'qwen' }); 
      } catch (e) {}
    }

    const checkInitialKey = async () => {
      if (aiConfig.mode === 'gemini' && !process.env.API_KEY) {
        const hasSelected = await window.aistudio?.hasSelectedApiKey?.().catch(() => false);
        if (!hasSelected) {
          setNeedsKeySelection(true);
        }
      }
    };
    checkInitialKey();
  }, [aiConfig.mode]);

  useEffect(() => {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfig));
  }, [aiConfig]);

  const handleAuthorize = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setNeedsKeySelection(false);
    }
  };

  const handleApiError = (error: any) => {
    const msg = error.message || "";
    if (msg.includes("API Key must be set") || msg.includes("Requested entity was not found")) {
      if (aiConfig.mode === 'gemini') {
        setNeedsKeySelection(true);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    const savedProfiles = localStorage.getItem(PROFILES_KEY);
    const lastActiveId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    let loadedProfiles = [DEFAULT_PROFILE];
    if (savedProfiles) {
      try { loadedProfiles = JSON.parse(savedProfiles); } catch (e) {}
    }
    setProfiles(loadedProfiles);
    const active = loadedProfiles.find(p => p.id === lastActiveId) || loadedProfiles[0];
    setCurrentProfile(active);
  }, []);

  useEffect(() => {
    setIsDataReady(false);
    const dataKey = `wealthtrack_data_${currentProfile.id}`;
    const savedData = localStorage.getItem(dataKey);
    if (savedData) {
      try {
        const data: PortfolioData = JSON.parse(savedData);
        setTrades(data.trades || []);
        setStockPortfolio(data.stockPortfolio || {});
        setBrokers(data.brokers || []);
      } catch (e) { setTrades([]); setStockPortfolio({}); setBrokers([]); }
    } else {
      setTrades([]); setStockPortfolio({}); setBrokers([]);
    }
    setAiAnalysis(null);
    setHasNewAnalysis(false);
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, currentProfile.id);
    const timer = setTimeout(() => setIsDataReady(true), 100);
    return () => clearTimeout(timer);
  }, [currentProfile]);

  useEffect(() => {
    if (!isDataReady) return;
    const dataKey = `wealthtrack_data_${currentProfile.id}`;
    const data: PortfolioData = { trades, stockPortfolio, brokers };
    setIsSyncingLocal(true);
    localStorage.setItem(dataKey, JSON.stringify(data));
    const syncTimer = setTimeout(() => {
      setIsSyncingLocal(false);
      setLastSaved(new Date().toLocaleTimeString());
    }, 500);
    return () => clearTimeout(syncTimer);
  }, [trades, stockPortfolio, brokers, currentProfile.id, isDataReady]);

  const handleMarketSync = async () => {
    if (isSyncingMarket) return;
    setIsSyncingMarket(true);
    const identifiers: string[] = [];
    Object.keys(stockPortfolio).forEach(k => identifiers.push(k.split('(')[0].toUpperCase()));
    trades.filter(t => t.status === 'open').forEach(t => {
      if (t.positionType.includes('Stock')) identifiers.push(t.stockName.toUpperCase());
      else identifiers.push(`${t.stockName} ${t.expiryDate} ${t.strikePrice} ${t.positionType.includes('Call') ? 'Call' : 'Put'}`.toUpperCase());
    });
    if (identifiers.length === 0) {
      setIsSyncingMarket(false);
      return;
    }
    try {
      const update = await fetchLatestPrices(identifiers, aiConfig);
      if (Object.keys(update.prices).length > 0) {
        setMarketUpdate(prev => ({
          prices: { ...prev.prices, ...update.prices },
          sources: update.sources.length > 0 ? update.sources : prev.sources
        }));
      }
    } catch (e: any) {
      handleApiError(e);
    } finally { setIsSyncingMarket(false); }
  };

  const startGlobalOcr = useCallback(async (selectedFiles: File[]) => {
    const newScreenshots: ScreenshotState[] = selectedFiles.map(file => ({
      file, preview: URL.createObjectURL(file), status: 'pending', progress: 0, candidates: []
    }));
    setGlobalScreenshots(prev => [...prev, ...newScreenshots]);
    setIsOcrProcessing(true);
    setHasOcrResults(false);
    const startIndex = globalScreenshots.length;
    for (let i = 0; i < newScreenshots.length; i++) {
      const globalIdx = startIndex + i;
      setGlobalScreenshots(prev => prev.map((item, idx) => idx === globalIdx ? { ...item, status: 'processing', progress: 50 } : item));
      try {
        const result = await performAiOcr(newScreenshots[i].file, aiConfig);
        setGlobalScreenshots(prev => prev.map((item, idx) => idx === globalIdx ? { ...item, status: 'ready', progress: 100, candidates: result.candidates.map(c => ({ ...c, broker: '' })) } : item));
      } catch (err: any) {
        if (!handleApiError(err)) {
          setGlobalScreenshots(prev => prev.map((item, idx) => idx === globalIdx ? { ...item, status: 'failed', error: err.message || '识别失败' } : item));
        } else {
          setIsOcrProcessing(false);
          break;
        }
      }
    }
    setIsOcrProcessing(false);
    setHasOcrResults(true);
  }, [globalScreenshots.length, aiConfig]);

  const handleSaveTrade = useCallback((tradeData: Partial<Trade>) => {
    const id = tradeData.id || Date.now() + Math.random();
    const newTrade: Trade = {
      id,
      positionType: tradeData.positionType as PositionType,
      stockName: (tradeData.stockName || '').toUpperCase(),
      broker: tradeData.broker,
      openDate: tradeData.openDate || new Date().toISOString().split('T')[0],
      openPrice: tradeData.openPrice || 0,
      totalQuantity: tradeData.totalQuantity || 0,
      remainingQuantity: tradeData.remainingQuantity ?? tradeData.totalQuantity ?? 0,
      status: tradeData.status || 'open',
      expiryDate: tradeData.expiryDate,
      strikePrice: tradeData.strikePrice,
      closeTransactions: tradeData.closeTransactions || []
    };
    setTrades(prev => [newTrade, ...prev]);
    if (newTrade.positionType === PositionType.BUY_STOCK) {
      setStockPortfolio(prev => {
        const ticker = newTrade.stockName.toUpperCase();
        const key = newTrade.broker ? `${ticker}(${newTrade.broker})` : ticker;
        const current = prev[key] || { quantity: 0, totalCost: 0, broker: newTrade.broker };
        return { ...prev, [key]: { quantity: current.quantity + newTrade.totalQuantity, totalCost: current.totalCost + (newTrade.totalQuantity * newTrade.openPrice), broker: newTrade.broker } };
      });
    }
  }, []);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setHasNewAnalysis(false);
    const openOptions = trades.filter(t => t.status === 'open' && t.remainingQuantity > 0);
    const tickerAgg: Record<string, { nominal: number, positions: any[] }> = {};
    openOptions.forEach(t => {
      const ticker = t.stockName;
      if (!tickerAgg[ticker]) tickerAgg[ticker] = { nominal: 0, positions: [] };
      const nominal = (t.strikePrice || t.openPrice) * 100 * t.remainingQuantity;
      tickerAgg[ticker].nominal += nominal;
      tickerAgg[ticker].positions.push({ type: t.positionType, expiry: t.expiryDate, strike: t.strikePrice, qty: t.remainingQuantity });
    });
    (Object.entries(stockPortfolio) as [string, StockHolding][]).forEach(([key, data]) => {
      const ticker = key.split('(')[0];
      if (!tickerAgg[ticker]) tickerAgg[ticker] = { nominal: 0, positions: [] };
      tickerAgg[ticker].nominal += (data.totalCost);
      tickerAgg[ticker].positions.push({ type: 'STOCK', qty: data.quantity });
    });
    const totalNominal = Object.values(tickerAgg).reduce((acc, curr) => acc + curr.nominal, 0);
    const payload = { portfolioSummary: { totalNominal, profileName: currentProfile.name }, aggregationByTicker: tickerAgg, positionsRawCount: openOptions.length + Object.keys(stockPortfolio).length };
    try {
      const res = await analyzePortfolio(payload, aiConfig);
      setAiAnalysis(res || "分析失败。");
      setHasNewAnalysis(true);
    } catch (e: any) {
      if (!handleApiError(e)) {
        setAiAnalysis("分析请求超时或失败。"); 
      }
    } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-lg sm:text-xl shadow-lg shadow-indigo-100">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">WealthTrack <span className="text-indigo-600">Pro</span></h1>
              <p className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest">v24 智能交易</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={hasNewAnalysis ? () => setHasNewAnalysis(false) : handleAiAnalysis} disabled={isAnalyzing} className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all text-[11px] sm:text-sm font-semibold ${isAnalyzing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : hasNewAnalysis ? 'bg-emerald-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
              <i className={`fa-solid ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              <span className="hidden xs:inline">{isAnalyzing ? '扫描中...' : hasNewAnalysis ? '查看报告' : '风险雷达'}</span>
            </button>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <UserSelector profiles={profiles} currentProfile={currentProfile} onSelect={setCurrentProfile} onDelete={() => {}} />
          </div>
        </div>
      </header>

      {needsKeySelection && aiConfig.mode === 'gemini' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl mx-auto shadow-2xl shadow-indigo-200">
              <i className="fa-solid fa-shield-keyhole"></i>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">授权 Gemini</h2>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">WealthTrack 检测到 API 密钥缺失。请通过 AI Studio 授权以启用智能分析功能。</p>
            </div>
            <button onClick={handleAuthorize} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 text-lg">
              <i className="fa-solid fa-fingerprint"></i> 立即授权
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-2 sm:px-4 mt-4 sm:mt-6">
        <div className="flex gap-1 bg-slate-200 p-1 rounded-xl mb-4 sm:mb-6 w-full overflow-x-auto no-scrollbar">
          {[
            { id: 'open', label: '持仓明细', icon: 'fa-briefcase' },
            { id: 'closed', label: '历史日志', icon: 'fa-clock-rotate-left' },
            { id: 'add', label: '手动录入', icon: 'fa-plus-circle', badge: hasOcrResults },
            { id: 'data', label: '系统设置', icon: 'fa-sliders' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative flex-1 min-w-[60px] px-1 sm:px-5 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}>
              <i className={`fa-solid ${tab.icon} text-xs sm:text-xs opacity-70`}></i>
              <span>{tab.label}</span>
              {tab.badge && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>}
            </button>
          ))}
        </div>

        {isDataReady && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
            {activeTab === 'open' && (
              <OpenPositions 
                trades={trades} stockPortfolio={stockPortfolio} brokers={brokers}
                marketUpdate={marketUpdate} isFetchingPrices={isSyncingMarket}
                onMarketSync={handleMarketSync} 
                onUpdateTrade={(id, up) => setTrades(prev => prev.map(t => t.id === id ? {...t, ...up} : t))} 
                onDeleteTrade={(id) => setTrades(prev => prev.filter(t => t.id !== id))}
                onBatchUpdateTrades={(upds) => setTrades(prev => { const n = [...prev]; upds.forEach(u => { const i = n.findIndex(t => t.id === u.id); if (i !== -1) n[i] = {...n[i], ...u.data}; }); return n; })} 
                onUpdateStock={(ok, q, c, t, b) => setStockPortfolio(prev => { const n = {...prev}; const s = (t || ok.split('(')[0]).toUpperCase(); const k = b ? `${s}(${b})` : s; if (k !== ok) delete n[ok]; if (q <= 0) { delete n[k]; return n; } n[k] = { quantity: q, totalCost: c, broker: b }; return n; })} 
                onDeleteStock={(k) => setStockPortfolio(prev => { const n = {...prev}; delete n[k]; return n; })}
              />
            )}
            {activeTab === 'closed' && (
              <ClosedLog trades={trades} onDeleteTrade={(id) => setTrades(prev => prev.filter(t => t.id !== id))} onDeleteTransaction={(tid, txid) => setTrades(prev => prev.map(t => (t.id === tid) ? {...t, status: 'open', remainingQuantity: t.remainingQuantity + t.closeTransactions.find(x => x.txId === txid)!.quantity, closeTransactions: t.closeTransactions.filter(x => x.txId !== txid)} : t))} />
            )}
            {activeTab === 'add' && <div className="p-4 sm:p-8 max-w-2xl mx-auto"><div className="flex items-center justify-between mb-8"><h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-circle-plus text-indigo-600"></i> 新增仓位</h2><button onClick={() => setShowOcrModal(true)} className="relative bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all"><i className="fa-solid fa-camera"></i> OCR 截图导入</button></div><TradeForm brokers={brokers} onSave={handleSaveTrade} /></div>}
            {activeTab === 'data' && <DataManagement aiConfig={aiConfig} onUpdateAiConfig={setAiConfig} trades={trades} stockPortfolio={stockPortfolio} brokers={brokers} currentProfile={currentProfile} onAddBroker={(n) => setBrokers(p => [...p, n])} onDeleteBroker={(n) => setBrokers(p => p.filter(b => b !== n))} onImport={(d) => { setTrades(d.trades); setStockPortfolio(d.stockPortfolio); setBrokers(d.brokers || []); setActiveTab('open'); }} />}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 px-6 z-[60] flex justify-between items-center">
        <div className="flex gap-4 sm:gap-6 items-center">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>活跃项: {trades.filter(t => t.status === 'open').length + Object.keys(stockPortfolio).length}</div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            AI 引擎: <span className={aiConfig.mode === 'gemini' ? 'text-indigo-600' : 'text-purple-600'}>{aiConfig.mode.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-400">
            {isSyncingLocal ? <i className="fa-solid fa-rotate fa-spin text-indigo-500"></i> : <><i className="fa-solid fa-cloud-check text-emerald-500"></i> 数据已同步 {lastSaved}</>}
          </div>
        </div>
      </footer>
      
      {showOcrModal && (
        <OcrImportModal onClose={() => setShowOcrModal(false)} onImport={(ts) => { ts.forEach(t => handleSaveTrade(t)); setGlobalScreenshots([]); setHasOcrResults(false); }} brokers={brokers} screenshots={globalScreenshots} isProcessing={isOcrProcessing} onUpdateScreenshots={setGlobalScreenshots} onStartOcr={startGlobalOcr} />
      )}

      {aiAnalysis && !hasNewAnalysis && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center text-white bg-indigo-600"><div className="flex items-center gap-3"><i className="fa-solid fa-robot text-xl"></i><div><h3 className="font-bold text-sm">AI 风险诊断报告 ({aiConfig.mode.toUpperCase()})</h3></div></div><button onClick={() => setAiAnalysis(null)} className="hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button></div>
            <div className="p-8 overflow-y-auto bg-slate-50/30"><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-sm whitespace-pre-wrap leading-relaxed text-slate-700 font-medium">{aiAnalysis}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
