
import { GoogleGenAI } from "@google/genai";
import { AiProviderConfig } from "../types";

const DEFAULT_QWEN_KEY = "sk-9259ee02978745e394c13f15e5381e41";
const DEFAULT_QWEN_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_QWEN_MODEL = "qwen-vl-plus";

const extractJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json|```/g, "").trim();
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.substring(startIdx, endIdx + 1);
  }
  return cleaned;
};

export const callAiEngine = async (params: {
  config?: AiProviderConfig;
  systemInstruction: string;
  prompt: string;
  jsonMode?: boolean;
  inlineData?: { data: string; mimeType: string };
  tools?: any[]; // 新增：支持工具配置（如 Google Search）
}) => {
  const { config, systemInstruction, prompt, jsonMode, inlineData, tools } = params;
  const mode = config?.mode || 'gemini';

  // --- Gemini 模式 ---
  if (mode === 'gemini') {
    if (!process.env.API_KEY) {
      throw new Error("Gemini API Key is missing. Please authorize.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 如果使用了 tools，建议升级到 Pro 模型以获得更好的逻辑推理
    const modelName = tools ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    const contents = inlineData 
      ? { parts: [{ inlineData: { data: inlineData.data, mimeType: inlineData.mimeType } }, { text: prompt }] }
      : prompt;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction + (jsonMode ? "\nReturn result in strict JSON format." : ""),
          responseMimeType: jsonMode ? "application/json" : undefined,
          temperature: 0.1,
          tools: tools, // 启用工具
        },
      });
      return response.text;
    } catch (error: any) {
      console.error(`Gemini (${modelName}) call failed:`, error);
      throw error;
    }
  }

  // --- Qwen 模式 ---
  if (mode === 'qwen') {
    const apiKey = config?.qwenApiKey || DEFAULT_QWEN_KEY;
    const endpoint = config?.qwenEndpoint || DEFAULT_QWEN_ENDPOINT;
    const model = config?.qwenModel || DEFAULT_QWEN_MODEL;

    const userContent = inlineData 
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${inlineData.mimeType};base64,${inlineData.data}` } }
        ]
      : prompt;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemInstruction + (jsonMode ? "\nReturn result in strict JSON format." : "") },
            { role: "user", content: userContent }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `API Error ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      return jsonMode ? extractJson(content) : content;
    } catch (error: any) {
      console.error("Qwen call failed:", error);
      throw error;
    }
  }

  throw new Error("Invalid AI Engine Mode");
};
