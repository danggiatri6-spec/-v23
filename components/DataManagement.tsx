
import React, { useState } from 'react';
import { Trade, StockHolding, PortfolioData, UserProfile, AiProviderConfig } from '../types';

interface DataManagementProps {
  trades: Trade[];
  stockPortfolio: Record<string, StockHolding>;
  brokers: string[];
  currentProfile: UserProfile;
  aiConfig: AiProviderConfig;
  onUpdateAiConfig: (config: AiProviderConfig) => void;
  onAddBroker: (name: string) => void;
  onDeleteBroker: (name: string) => void;
  onImport: (data: PortfolioData) => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ 
  trades, 
  stockPortfolio, 
  brokers,
  currentProfile,
  aiConfig,
  onUpdateAiConfig,
  onAddBroker,
  onDeleteBroker,
  onImport 
}) => {
  const [newBroker, setNewBroker] = useState('');
  const [localConfig, setLocalConfig] = useState<AiProviderConfig>(aiConfig);

  const handleExport = () => {
    const data: PortfolioData = { trades, stockPortfolio, brokers };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `财富追踪备份-${currentProfile.name}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.trades && data.stockPortfolio) {
          onImport(data);
          alert(`数据已成功导入账户: ${currentProfile.name}`);
        } else {
          alert('无效的备份文件格式。');
        }
      } catch (err) {
        alert('文件解析失败。');
      }
    };
    reader.readAsText(file);
  };

  const saveAiConfig = () => {
    onUpdateAiConfig(localConfig);
    alert("AI 引擎配置已更新");
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-12">
      
      {/* AI Configuration Section */}
      <section className="space-y-4 sm:space-y-6">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-robot text-indigo-600"></i> AI 智能分析引擎配置
          </h3>
          <p className="text-xs text-slate-500 mt-1">配置底层的 AI 驱动，以获得最佳的策略分析和风险评估</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            <button 
              onClick={() => setLocalConfig({...localConfig, mode: 'gemini'})}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${localConfig.mode === 'gemini' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Google Gemini
            </button>
            <button 
              onClick={() => setLocalConfig({...localConfig, mode: 'qwen'})}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${localConfig.mode === 'qwen' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              通义千问 (Qwen-VL)
            </button>
          </div>

          {localConfig.mode === 'qwen' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qwen API Key</label>
                <input 
                  type="password" 
                  value={localConfig.qwenApiKey || ''} 
                  onChange={e => setLocalConfig({...localConfig, qwenApiKey: e.target.value})}
                  placeholder="请输入您的 API Key..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">模型名称</label>
                  <input 
                    type="text" 
                    value={localConfig.qwenModel || ''} 
                    onChange={e => setLocalConfig({...localConfig, qwenModel: e.target.value})}
                    placeholder="例如: qwen-vl-plus"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API 代理/终端</label>
                  <input 
                    type="text" 
                    value={localConfig.qwenEndpoint || ''} 
                    onChange={e => setLocalConfig({...localConfig, qwenEndpoint: e.target.value})}
                    placeholder="https://dashscope..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {localConfig.mode === 'gemini' && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                <i className="fa-solid fa-circle-info mr-2"></i>
                当前激活 Google Gemini 引擎。支持实时联网搜索、深度期权策略生成以及多模态截图识别。
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button 
              onClick={saveAiConfig}
              className={`px-8 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all ${localConfig.mode === 'qwen' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
            >
              应用 AI 配置
            </button>
          </div>
        </div>
      </section>

      {/* Broker Management Section */}
      <section className="space-y-4 sm:space-y-6">
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-building-columns text-indigo-600"></i> 券商账户管理
        </h3>
        <div className="bg-indigo-50/50 rounded-2xl p-4 sm:p-6 border border-indigo-100/50">
          <form onSubmit={(e) => { e.preventDefault(); if (newBroker.trim()) { onAddBroker(newBroker.trim()); setNewBroker(''); } }} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
            <input 
              type="text" 
              value={newBroker}
              onChange={(e) => setNewBroker(e.target.value)}
              placeholder="新增券商/账户名称 (如: 富途牛牛)"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all text-sm">添加</button>
          </form>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
            {brokers.map(broker => (
              <div key={broker} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-100 group shadow-sm">
                <span className="text-xs sm:text-sm font-bold text-slate-700">{broker}</span>
                <button onClick={() => onDeleteBroker(broker)} className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Maintenance Section */}
      <section className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 border-t border-slate-100">
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-database text-amber-600"></i> 数据备份与恢复
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
            <i className="fa-solid fa-cloud-arrow-down text-indigo-600 text-2xl mb-4"></i>
            <h3 className="text-base font-bold text-slate-800 mb-4">导出 JSON 备份文件</h3>
            <button onClick={handleExport} className="w-full bg-white border-2 border-indigo-600 text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-sm">立即导出</button>
          </div>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
            <i className="fa-solid fa-cloud-arrow-up text-amber-600 text-2xl mb-4"></i>
            <h3 className="text-base font-bold text-slate-800 mb-4">从本地文件恢复</h3>
            <label className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition-all cursor-pointer text-sm block">
              <i className="fa-solid fa-file-import mr-2"></i> 选择文件并导入
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DataManagement;
