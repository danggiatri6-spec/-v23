// [MAPPING SERVICE] 迁移至 AI 驱动
export const BROKER_TEMPLATES = [
  { id: 'generic', name: '智能通用识别' }
];

/**
 * 此时 mappingService 仅保留基础格式化功能
 */
export const formatTicker = (ticker: string) => {
  return ticker.trim().toUpperCase();
};
