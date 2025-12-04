import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIAnalysisResult, AISimilarQuestionResult } from "../types";

// Helper: Get API Key safely for Vite/Browser environment
const getApiKey = () => {
  // Try standard process.env (for Node/Next.js compatibility)
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    return process.env.API_KEY;
  }
  // Try Vite's import.meta.env (Standard for Vite apps)
  // @ts-ignore
  if (import.meta.env?.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  return '';
};

// Initialize client lazily to prevent top-level crashes
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn("Gemini API Key is missing. Features will not work. Please check your Vercel Environment Variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey });
  }
  return aiInstance;
};

// Helper: Wait function
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Retry wrapper with exponential backoff
async function withRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  let delay = initialDelay;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // Check for quota/rate limit errors (429 or specific messages)
      const isQuotaError = error.status === 429 || 
                           (error.message && (error.message.includes('quota') || error.message.includes('429')));
      
      // Also retry on syntax errors (JSON parse errors) as they might be due to transient truncation or model glitches
      const isSyntaxError = error instanceof SyntaxError || (error.message && error.message.includes('JSON'));

      if ((isQuotaError || isSyntaxError) && i < retries - 1) {
        console.warn(`Error encountered (${isQuotaError ? 'Quota' : 'Syntax'}). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await wait(delay);
        delay *= 2; // Exponential backoff
        continue;
      }
      // If it's not a recoverable error, or we ran out of retries, throw immediately
      throw error;
    }
  }
  throw lastError;
}

// Helper: Clean and Parse JSON safely
function safeJsonParse<T>(text: string): T {
  // Remove markdown code blocks if present (e.g. ```json ... ```)
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Helper to convert file to base64 (Raw base64)
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeImage = async (dataUrlOrBase64: string, userHint: string): Promise<AIAnalysisResult> => {
  const modelId = "gemini-2.5-flash"; 
  const ai = getAI();
  
  // 1. Process the image data
  let mimeType = 'image/jpeg';
  let base64Data = dataUrlOrBase64;

  if (dataUrlOrBase64.includes('base64,')) {
      const parts = dataUrlOrBase64.split('base64,');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
          mimeType = mimeMatch[1];
      }
  }

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      questionText: { type: Type.STRING, description: "画像から転写された質問のテキスト。" },
      solution: { type: Type.STRING, description: "問題に対する段階的な正しい解決策。" },
      analysis: { type: Type.STRING, description: "なぜ学生が間違えた可能性があるかの分析と、関連する重要な概念。" },
      tags: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "この質問に関連する3〜5個の短いキーワード。" 
      },
      suggestedSubject: { type: Type.STRING, description: "学術的な科目 (国語, 算数, 理科, 社会, その他)." },
      svgDiagram: { type: Type.STRING, description: "幾何学的な図やグラフが必要な場合、説明を助けるためのSVGコード（<svg>...</svg>）。複雑なパスデータは避け、簡潔な図形プリミティブを使用してください。図が不要な場合は空文字列。" }
    },
    required: ["questionText", "solution", "analysis", "tags", "suggestedSubject"]
  };

  const prompt = `この宿題や試験の問題の画像を分析してください。日本語で出力してください。
  1. 問題文を正確に書き起こしてください。
  2. 問題を徹底的に解いてください。
  3. 核となる概念を説明してください。
  4. タグを提案してください。
  5. もし幾何学の問題やグラフを含む問題であれば、説明を助けるためのシンプルで軽量なSVGコードを作成してください。
  ${userHint ? `ユーザーメモ: ${userHint}` : ''}`;

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.4,
          maxOutputTokens: 8192 // Ensure enough tokens for SVG + Text
        }
      });

      if (response.text) {
        return safeJsonParse<AIAnalysisResult>(response.text);
      }
      throw new Error("No response text from Gemini");
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      throw error;
    }
  });
};

export const generateSimilarQuestion = async (originalQuestion: string, originalAnalysis: string): Promise<AISimilarQuestionResult> => {
    const modelId = "gemini-2.5-flash";
    const ai = getAI();

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING, description: "元の問題と論理/概念が似ている新しい練習問題。" },
            answer: { type: Type.STRING, description: "新しい問題の正解と短い説明。" },
            svgDiagram: { type: Type.STRING, description: "新しい問題に図が必要な場合のSVGコード。必要ない場合は空文字列。" }
        },
        required: ["question", "answer"]
    };

    const prompt = `元の質問：「${originalQuestion}」とその分析：「${originalAnalysis || ''}」に基づいて、学生の理解度を確認するための新しい類似の練習問題を作成してください。数字や文脈を変えても、同じ概念をテストするようにしてください。幾何学や関数の問題であれば、新しい問題に対応するシンプルで軽量なSVG図形コードも含めてください。日本語で出力してください。`;

    return withRetry(async () => {
        try {
            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    maxOutputTokens: 8192 // Ensure enough tokens
                }
            });

            if (response.text) {
                return safeJsonParse<AISimilarQuestionResult>(response.text);
            }
            throw new Error("No response text");
        } catch (error) {
            console.error("Gemini Generation Error:", error);
            throw error;
        }
    });
}