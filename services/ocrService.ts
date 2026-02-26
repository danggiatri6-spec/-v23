
import { GoogleGenAI } from "@google/genai";
import { OcrTradeCandidate, PositionType, AiProviderConfig } from "../types";
import { callAiEngine } from "./aiBridge";

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
};

export const performAiOcr = async (file: File, config?: AiProviderConfig): Promise<{ candidates: OcrTradeCandidate[], rawSummary: string }> => {
  const base64Data = await fileToBase64(file);
  
  const systemPrompt = `你是一个极其精准的金融交易截图识别专家。你的任务是从用户提供的截图中提取交易明细。
    
    识别核心字段：
    1. 交易方向：识别为 "买入" (Buy/Long/开仓) 或 "卖空" (Sell/Short/平仓)。
       - 截图若显示“买入/开仓”，对应 Buy/Long。
       - 截图若显示“卖出/平仓”，对应 Sell/Short。
    2. 订单状态：仅提取“全部成交”或“已完成”的记录。
    3. 期权代码解析：针对类似 "MARA PUT 260116 9.5" 的字符串：
       - Ticker: 提取代码（如 MARA）。
       - 类型: 识别 PUT (看跌) 或 CALL (看涨)。
       - 到期日: 将 YYMMDD 格式（如 260116）解析为 YYYY-MM-DD（如 2026-01-16）。
       - 行权价: 提取数字部分（如 9.5）。
    4. 数量与价格：
       - 数量: 提取“成交数量”字段。
       - 均价: 提取“成交均价”或单价字段。
    5. 时间：提取“下单时间”或成交时间中的日期（YYYY-MM-DD）。

    输出要求：
    - 严格 JSON 格式。
    - 结构如下：
      {
        "trades": [
          {
            "ticker": "MARA",
            "direction": "卖空",
            "assetType": "option",
            "optionType": "PUT",
            "expiry": "2026-01-16",
            "strike": 9.5,
            "quantity": 2,
            "price": 0.59,
            "time": "2025-12-23",
            "rawName": "MARA PUT 260116 9.5"
          }
        ],
        "rawSummary": "简短中文描述识别情况"
      }
  `;

  // 直接调用 AI Bridge 处理多模态识别
  try {
    const text = await callAiEngine({
      config,
      systemInstruction: systemPrompt,
      prompt: `请分析这张期权交易订单截图，提取所有关键字段（Ticker, 方向, 数量, 价格, 到期日, 行权价, 时间）。`,
      jsonMode: true,
      inlineData: { data: base64Data, mimeType: file.type }
    });
    return processOcrResult(JSON.parse(text || "{}"));
  } catch (err: any) {
    console.error("AI OCR Invocation Error:", err);
    throw err;
  }
};

function processOcrResult(result: any) {
  const tradesList = Array.isArray(result.trades) ? result.trades : [];
  const candidates: OcrTradeCandidate[] = tradesList.map((t: any) => {
    let posType = PositionType.BUY_STOCK;
    
    const direction = String(t.direction || "买入").toLowerCase();
    const isBuy = /买|buy|b|long|开仓|多/i.test(direction) && !/卖|sell|short|空|平/i.test(direction);
    const assetType = String(t.assetType || "").toLowerCase();
    
    // 判定是否为期权
    const isOption = assetType.includes("option") || !!t.expiry || !!t.strike || String(t.rawName || "").includes("PUT") || String(t.rawName || "").includes("CALL");
    
    if (isOption) {
      const isPut = /put|p|沽|看跌/i.test(String(t.optionType || t.rawName || "").toLowerCase());
      if (isBuy) {
        posType = isPut ? PositionType.LONG_PUT : PositionType.LONG_CALL;
      } else {
        posType = isPut ? PositionType.SHORT_PUT : PositionType.SHORT_CALL;
      }
    } else {
      posType = isBuy ? PositionType.BUY_STOCK : PositionType.SELL_STOCK;
    }

    return {
      id: Math.random(),
      stockName: String(t.ticker || "UNKNOWN").toUpperCase(),
      broker: 'AI 识别',
      openPrice: parseFloat(t.price || 0) || 0,
      totalQuantity: Math.abs(parseInt(t.quantity || 0)) || 0,
      remainingQuantity: Math.abs(parseInt(t.quantity || 0)) || 0,
      openDate: t.time || new Date().toISOString().split('T')[0],
      positionType: posType,
      expiryDate: t.expiry || undefined,
      strikePrice: t.strike || undefined,
      confidence: 'high',
      fingerprint: t.rawName || t.ticker || '',
      rawText: t.rawName || ''
    };
  });
  return { candidates, rawSummary: result.rawSummary || `成功识别 ${candidates.length} 笔交易` };
}
