
import { GoogleGenAI } from "@google/genai";
import { callAiEngine } from "./aiBridge";
import { AiProviderConfig } from "../types";

export interface MarketData {
  price: number;
  volume?: number;
  amount?: number;
  time?: string;
  currency?: string;
}

export interface MarketUpdate {
  prices: Record<string, MarketData>;
  sources: { title: string; uri: string }[];
}

const parseMarketData = (text: string): Record<string, MarketData> => {
  const results: Record<string, MarketData> = {};
  if (!text) return results;

  // 尝试匹配格式: "代码: 价格, 量: X, 金额: Y, 时间: Z" 或类似结构
  const lines = text.split('\n');
  lines.forEach(line => {
    let cleanLine = line.replace(/[*#]/g, '').trim();
    const separatorMatch = cleanLine.match(/[:\-=]/);
    if (!separatorMatch) return;

    const symbolPart = cleanLine.substring(0, separatorMatch.index!).trim().toUpperCase();
    const dataPart = cleanLine.substring(separatorMatch.index! + 1).trim();

    // 提取价格 (第一个数字)
    const priceMatch = dataPart.match(/\d+(\.\d+)?/);
    if (symbolPart && priceMatch) {
      const data: MarketData = {
        price: parseFloat(priceMatch[0])
      };

      // 尝试提取成交量 (匹配 "量", "Vol", "Quantity")
      const volMatch = dataPart.match(/(?:量|Vol|Quantity)[:\s]*(\d+)/i);
      if (volMatch) data.volume = parseInt(volMatch[1]);

      // 尝试提取金额 (匹配 "金额", "Amt", "Value")
      const amtMatch = dataPart.match(/(?:金额|Amt|Value)[:\s]*(\d+(?:\.\d+)?)/i);
      if (amtMatch) data.amount = parseFloat(amtMatch[1]);

      // 尝试提取时间 (匹配日期时间格式)
      const timeMatch = dataPart.match(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:\s\d{1,2}:\d{1,2}(?::\d{1,2})?)?/);
      if (timeMatch) data.time = timeMatch[0];

      results[symbolPart] = data;
    }
  });
  return results;
};

export const fetchLatestPrices = async (identifiers: string[], config?: AiProviderConfig): Promise<MarketUpdate> => {
  if (identifiers.length === 0) return { prices: {}, sources: [] };
  const list = Array.from(new Set(identifiers)).join(", ");
  
  const systemInstruction = `你是一个专业的金融行情终端。
    请获取并提供以下标的的最新实时市场数据: ${list}。
    
    对于期权标的（如 MARA PUT 260116 9.5），请务必：
    1. 解析名称中的到期日和行权价。
    2. 提供最新成交价、成交量、成交金额。
    3. 提供数据的时间戳（交易时间）。
    
    输出格式要求：
    代码: 价格, 量: 成交量, 金额: 成交金额, 时间: 交易时间
    每一行一个标的。`;

  const prompt = `查找最新行情：${list}`;

  // Google Search 仅在使用 Gemini Pro 时可用
  if (!config || config.mode === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
          systemInstruction,
          tools: [{ googleSearch: {} }], 
          temperature: 0 
        },
      });
      const text = response.text || "";
      const prices = parseMarketData(text);
      const sources: { title: string; uri: string }[] = [];
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((chunk: any) => {
        if (chunk.web?.uri) sources.push({ title: chunk.web.title || "行情来源", uri: chunk.web.uri });
      });
      if (Object.keys(prices).length > 0) return { prices, sources };
    } catch (e) {
      console.warn("Gemini Search failed, falling back...");
    }
  }

  // 降级使用普通聊天模型
  try {
    const fallbackText = await callAiEngine({
      config,
      systemInstruction,
      prompt,
    });
    return { prices: parseMarketData(fallbackText), sources: [] };
  } catch (err) {
    return { prices: {}, sources: [] };
  }
};
