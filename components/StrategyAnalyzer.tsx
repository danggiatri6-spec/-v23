
import React, { useState, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { Trade, PositionType } from '../types';
import { MarketUpdate } from '../services/marketService';

interface StrategyAnalyzerProps {
  trades: Trade[];
  marketUpdate: MarketUpdate;
  initialTrades?: Trade[] | null;
  onClearInitial?: () => void;
}

const StrategyAnalyzer: React.FC<StrategyAnalyzerProps> = ({ 
  trades, 
  marketUpdate, 
  initialTrades,
  onClearInitial 
}) => {
  const [underlyingPrice, setUnderlyingPrice] = useState<number>(180);
  const [sellPutStrike, setSellPutStrike] = useState<number>(175);
  const [sellPutPremium, setSellPutPremium] = useState<number>(5.5);
  const [buyPutStrike, setBuyPutStrike] = useState<number>(170);
  const [buyPutPremium, setBuyPutPremium] = useState<number>(3.2);
  const [currentTicker, setCurrentTicker] = useState<string>('');

  React.useEffect(() => {
    if (initialTrades && initialTrades.length >= 2) {
      const sellPut = initialTrades.find(t => t.positionType === PositionType.SHORT_PUT);
      const buyPut = initialTrades.find(t => t.positionType === PositionType.LONG_PUT);
      
      if (sellPut) {
        setSellPutStrike(sellPut.strikePrice || 0);
        setSellPutPremium(sellPut.openPrice || 0);
      }
      if (buyPut) {
        setBuyPutStrike(buyPut.strikePrice || 0);
        setBuyPutPremium(buyPut.openPrice || 0);
      }

      const ticker = initialTrades[0].stockName.toUpperCase();
      setCurrentTicker(ticker);
      if (marketUpdate.prices[ticker]) {
        setUnderlyingPrice(marketUpdate.prices[ticker]);
      }
      
      if (onClearInitial) onClearInitial();
    }
  }, [initialTrades, marketUpdate.prices, onClearInitial]);

  const data = useMemo(() => {
    const points = [];
    const minStrike = Math.min(sellPutStrike, buyPutStrike);
    const maxStrike = Math.max(sellPutStrike, buyPutStrike);
    const range = Math.max(20, (maxStrike - minStrike) * 2);
    const start = Math.max(0, minStrike - range / 2);
    const end = maxStrike + range / 2;
    const step = (end - start) / 50;

    for (let s = start; s <= end; s += step) {
      const shortPutPnL = sellPutPremium - Math.max(0, sellPutStrike - s);
      const longPutPnL = Math.max(0, buyPutStrike - s) - buyPutPremium;
      const totalPnL = (shortPutPnL + longPutPnL) * 100;
      points.push({
        price: parseFloat(s.toFixed(2)),
        pnl: parseFloat(totalPnL.toFixed(2)),
      });
    }
    return points;
  }, [sellPutStrike, sellPutPremium, buyPutStrike, buyPutPremium]);

  const analysis = useMemo(() => {
    const netPremium = sellPutPremium - buyPutPremium;
    const isCredit = netPremium > 0;
    
    let maxProfit = 0;
    let maxLoss = 0;
    let breakEven = 0;
    let strategyName = "";

    if (sellPutStrike > buyPutStrike) {
      strategyName = isCredit ? "牛市看跌价差 (Bull Put Spread)" : "熊市看跌价差 (Bear Put Spread)";
      maxProfit = isCredit ? netPremium * 100 : (buyPutStrike - sellPutStrike + netPremium) * 100;
      maxLoss = isCredit ? (buyPutStrike - sellPutStrike + netPremium) * 100 : netPremium * 100;
      breakEven = sellPutStrike - netPremium;
    } else if (sellPutStrike < buyPutStrike) {
      strategyName = isCredit ? "反向看跌价差" : "熊市看跌价差 (Bear Put Spread)";
      maxProfit = !isCredit ? (buyPutStrike - sellPutStrike - buyPutPremium + sellPutPremium) * 100 : 0;
      maxLoss = !isCredit ? (sellPutPremium - buyPutPremium) * 100 : (sellPutStrike - buyPutStrike + netPremium) * 100;
      breakEven = buyPutStrike - netPremium;
    } else {
      strategyName = "相同行权价组合";
      maxProfit = netPremium * 100;
      maxLoss = netPremium * 100;
      breakEven = sellPutStrike;
    }

    return {
      netPremium,
      maxProfit,
      maxLoss,
      breakEven,
      strategyName
    };
  }, [sellPutStrike, sellPutPremium, buyPutStrike, buyPutPremium]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
            <i className="fa-solid fa-chart-area"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">期权组合策略分析</h2>
            <p className="text-xs text-slate-500 font-medium">垂直价差 (Vertical Spread) 盈亏模拟</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">策略参数设定</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">标的参考价</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={underlyingPrice} 
                    onChange={(e) => setUnderlyingPrice(parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {currentTicker && marketUpdate.prices[currentTicker] && (
                    <button 
                      onClick={() => setUnderlyingPrice(marketUpdate.prices[currentTicker])}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                    >
                      同步现价
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-[11px] uppercase">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Sell Put (卖出看跌)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">行权价</label>
                    <input type="number" value={sellPutStrike} onChange={(e) => setSellPutStrike(parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">权利金</label>
                    <input type="number" value={sellPutPremium} onChange={(e) => setSellPutPremium(parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-[11px] uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Buy Put (买入看跌)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">行权价</label>
                    <input type="number" value={buyPutStrike} onChange={(e) => setBuyPutStrike(parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">权利金</label>
                    <input type="number" value={buyPutPremium} onChange={(e) => setBuyPutPremium(parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 space-y-4">
            <h3 className="text-[10px] font-black opacity-60 uppercase tracking-widest">核心指标分析</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] opacity-70 font-bold uppercase">最大盈利</p>
                <p className="text-xl font-black text-emerald-300">
                  {analysis.maxProfit > 0 ? `+$${analysis.maxProfit.toFixed(0)}` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[10px] opacity-70 font-bold uppercase">最大亏损</p>
                <p className="text-xl font-black text-rose-300">
                  {analysis.maxLoss < 0 ? `-$${Math.abs(analysis.maxLoss).toFixed(0)}` : '--'}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-white/10">
                <p className="text-[10px] opacity-70 font-bold uppercase">盈亏平衡点 (Break-even)</p>
                <p className="text-lg font-black">${analysis.breakEven.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-[400px]">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">到期盈亏曲线 (P&L Curve)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="price" 
                  type="number" 
                  domain={['dataMin', 'dataMax']} 
                  tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold'}}
                  formatter={(value: number) => [`$${value}`, '盈亏']}
                  labelFormatter={(label) => `标的价格: $${label}`}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={2} />
                <ReferenceLine x={underlyingPrice} stroke="#6366f1" strokeDasharray="3 3" label={{ position: 'top', value: '当前价', fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} />
                <Area 
                  type="monotone" 
                  dataKey="pnl" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPnl)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">策略深度解析</h3>
            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800">
                当前组合被识别为：<span className="text-indigo-600">{analysis.strategyName}</span>
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  此策略通过卖出高行权价 Put 并买入低行权价 Put 构建。
                  {analysis.netPremium > 0 ? 
                    `开仓即获得 $${(analysis.netPremium * 100).toFixed(0)} 的净权利金收入。` : 
                    `开仓需支付 $${(Math.abs(analysis.netPremium) * 100).toFixed(0)} 的权利金成本。`
                  }
                </li>
                <li>
                  当标的价格保持在 <span className="font-bold text-slate-800">${sellPutStrike}</span> 之上时，您将获得最大收益 
                  <span className="text-emerald-600 font-bold"> $${Math.abs(analysis.maxProfit).toFixed(0)}</span>。
                </li>
                <li>
                  盈亏平衡点位于 <span className="font-bold text-slate-800">${analysis.breakEven.toFixed(2)}</span>。
                  如果到期时价格低于此点，策略将开始产生亏损。
                </li>
                <li>
                  最大风险被锁定在 <span className="text-rose-600 font-bold">$${Math.abs(analysis.maxLoss).toFixed(0)}</span>，
                  这发生在标的价格跌破 <span className="font-bold text-slate-800">${buyPutStrike}</span> 时。
                </li>
              </ul>
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-700 italic">
                提示：垂直价差策略是一种风险有限、收益有限的策略，适合在预期标的小幅上涨或震荡时使用。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyAnalyzer;
