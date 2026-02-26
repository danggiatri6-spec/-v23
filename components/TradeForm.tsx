
import React, { useState } from 'react';
import { PositionType, Trade } from '../types';

interface TradeFormProps {
  brokers: string[];
  onSave: (trade: Partial<Trade>) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ brokers, onSave }) => {
  const [positionType, setPositionType] = useState<PositionType>(PositionType.BUY_STOCK);
  const [ticker, setTicker] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [openPrice, setOpenPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [openDate, setOpenDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      positionType,
      stockName: ticker.trim().toUpperCase(),
      broker: selectedBroker || undefined,
      expiryDate: positionType.includes('Stock') ? undefined : expiryDate,
      strikePrice: positionType.includes('Stock') ? undefined : parseFloat(strikePrice),
      openPrice: parseFloat(openPrice),
      totalQuantity: parseFloat(quantity),
      openDate
    });
    
    setTicker('');
    setStrikePrice('');
    setOpenPrice('');
    setQuantity('');
  };

  const isOption = !positionType.includes('Stock');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">交易头寸类型</label>
          <select 
            value={positionType} 
            onChange={(e) => setPositionType(e.target.value as PositionType)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          >
            <option value={PositionType.BUY_STOCK}>买入正股 (Long Stock)</option>
            <option value={PositionType.SHORT_PUT}>卖出 Put (Short Put)</option>
            <option value={PositionType.SHORT_CALL}>卖出 Call (Short Call)</option>
            <option value={PositionType.LONG_PUT}>买入 Put (Long Put)</option>
            <option value={PositionType.LONG_CALL}>买入 Call (Long Call)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">股票/标的代码</label>
          <input 
            type="text" 
            value={ticker} 
            onChange={(e) => setTicker(e.target.value)}
            placeholder="例如: AAPL, TSLA"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">所属券商/账户</label>
          <select 
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">默认账户</option>
            {brokers.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 font-medium italic">* 在“系统设置”中可管理券商列表</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">开仓日期</label>
          <input 
            type="date" 
            value={openDate} 
            onChange={(e) => setOpenDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>

        {isOption && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">行权价 (Strike)</label>
              <input 
                type="number" 
                step="0.01" 
                value={strikePrice} 
                onChange={(e) => setStrikePrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">期权到期日</label>
              <input 
                type="date" 
                value={expiryDate} 
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">开仓单价</label>
          <input 
            type="number" 
            step="0.01" 
            value={openPrice} 
            onChange={(e) => setOpenPrice(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-slate-700">成交数量</label>
          <input 
            type="number" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
      >
        <i className="fa-solid fa-floppy-disk"></i> 保存并入库
      </button>
    </form>
  );
};

export default TradeForm;
