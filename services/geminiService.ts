
import { callAiEngine } from "./aiBridge";
import { AiProviderConfig } from "../types";

export const analyzePortfolio = async (payload: any, config?: AiProviderConfig) => {
  const systemInstruction = `
    你是一个专业的对冲基金风险经理。你的任务是分析用户的投资组合集中度风险。
    输出语言：必须全中文。
    输出主题：持仓集中度风险为主。
    风格：理性、中性、风控第一。
    禁止：禁止交易指令、价格预测、收益承诺。
    结构：总览、标的集中度、时间集中度、结构叠加（多腿风险）、留意vs观察、信息缺口、总结提醒。
  `;

  try {
    const text = await callAiEngine({
      config,
      systemInstruction,
      prompt: `请分析以下组合数据：\n${JSON.stringify(payload, null, 2)}`,
    });
    return text;
  } catch (error: any) {
    return `分析请求失败：${error.message}`;
  }
};
