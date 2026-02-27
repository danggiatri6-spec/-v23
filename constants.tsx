
import React from 'react';

export const COLORS = {
  profit: 'text-emerald-600',
  loss: 'text-rose-600',
  profitBg: 'bg-emerald-50',
  lossBg: 'bg-rose-50',
  primary: 'indigo-600',
  secondary: 'slate-600'
};

export const ICONS = {
  stock: <i className="fa-solid fa-arrow-trend-up"></i>,
  option: <i className="fa-solid fa-bolt"></i>,
  profit: <i className="fa-solid fa-circle-check text-emerald-500"></i>,
  loss: <i className="fa-solid fa-circle-xmark text-rose-500"></i>,
  risk: <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
};

export const DEFAULT_BROKERS = ['富途', '哈富', '华盛', '长桥HK', '长桥SG', '老虎', '盈立'];
