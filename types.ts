
export enum PositionType {
  BUY_STOCK = 'Buy Stock',
  SELL_STOCK = 'Sell Stock',
  SHORT_PUT = 'Short Put',
  SHORT_CALL = 'Short Call',
  LONG_PUT = 'Long Put',
  LONG_CALL = 'Long Call'
}

export interface CloseTransaction {
  txId: number;
  date: string;
  price: number;
  quantity: number;
  profit: number;
}

export interface Trade {
  id: number;
  positionType: PositionType;
  stockName: string;
  broker?: string;
  openDate: string;
  openPrice: number;
  totalQuantity: number;
  remainingQuantity: number;
  status: 'open' | 'closed';
  expiryDate?: string;
  strikePrice?: number;
  closeTransactions: CloseTransaction[];
}

export interface StockHolding {
  quantity: number;
  totalCost: number;
  broker?: string;
}

export interface PortfolioData {
  trades: Trade[];
  stockPortfolio: Record<string, StockHolding>;
  brokers: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
}

export type SummaryTimescale = 'month' | 'week';

// AI Provider Config
export type AiProviderMode = 'gemini' | 'qwen';

export interface AiProviderConfig {
  mode: AiProviderMode;
  qwenApiKey?: string;
  qwenModel?: string;
  qwenEndpoint?: string;
}

// OCR Types
export interface OcrTradeCandidate {
  id: number;
  stockName: string;
  broker: string;
  openPrice: number;
  totalQuantity: number;
  remainingQuantity: number;
  openDate: string;
  positionType: PositionType;
  expiryDate?: string;
  strikePrice?: number;
  confidence: 'high' | 'medium' | 'low';
  fingerprint: string;
  rawText?: string;
}

export interface ScreenshotState {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'selecting_broker' | 'ready' | 'failed' | 'success';
  progress: number;
  rawText?: string;
  broker?: string;
  candidates: OcrTradeCandidate[];
  error?: string;
}
