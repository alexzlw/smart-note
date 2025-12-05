
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIAnalysisResult, AISimilarQuestionResult, Language } from "../types";

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
  
  // Fallback: Use the hardcoded key from firebase config (as a backup for quick deployment)
  return "AIzaSyBnZqJXPcGovWkiB2UX_UquydvV3jE8tLM";
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

// Helper to fetch image from URL and convert to Base64
async function urlToData(url: string): Promise<{ mimeType: string, base64Data: string }> {
  try {
    // Note: This fetch requires CORS to be configured on the Firebase Storage bucket.
    // Standard fetch from browser to storage bucket.
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // base64String looks like "data:image/jpeg;base64,/9j/4AAQSk..."
        const parts = base64String.split('base64,');
        const mimeMatch = parts[0].match(/data:(.*?);/);
        resolve({
          mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
          base64Data: parts[1]
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting URL to base64:", error);
    // Provide a helpful error message about CORS
    throw new Error("Failed to download image from cloud. If you are using Firebase Storage, please ensure CORS is configured on your bucket.");
  }
}

export const analyzeImage = async (dataUrlOrBase64: string, userHint: string, language: Language = 'ja'): Promise<AIAnalysisResult> => {
  const modelId = "gemini-2.5-flash"; 
  const ai = getAI();
  
  // 1. Process the image data
  let mimeType = 'image/jpeg';
  let base64Data = '';

  // Check if input is a URL (http/https)
  if (dataUrlOrBase64.startsWith('http')) {
      try {
          const imageData = await urlToData(dataUrlOrBase64);
          mimeType = imageData.mimeType;
          base64Data = imageData.base64Data;
      } catch (e: any) {
          console.error("Image Download Error", e);
          throw new Error(e.message || "Failed to download image for analysis");
      }
  } 
  // Check if input is Data URL
  else if (dataUrlOrBase64.includes('base64,')) {
      const parts = dataUrlOrBase64.split('base64,');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
          mimeType = mimeMatch[1];
      }
  } 
  // Assume raw base64
  else {
      base64Data = dataUrlOrBase64;
  }

  // Define language specifics
  const langName = language === 'en' ? 'English' : language === 'zh' ? 'Chinese (Simplified)' : 'Japanese';

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      questionText: { type: Type.STRING, description: "Transcription of the question." },
      solution: { type: Type.STRING, description: "Step-by-step correct solution." },
      analysis: { type: Type.STRING, description: "Analysis of why the student might have made a mistake and key concepts." },
      tags: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3-5 short keywords related to this question." 
      },
      suggestedSubject: { type: Type.STRING, description: "Academic subject (Math, Science, etc)." },
      svgDiagram: { type: Type.STRING, description: "SVG code if a diagram is helpful. Empty string if not needed." }
    },
    required: ["questionText", "solution", "analysis", "tags", "suggestedSubject"]
  };

  const prompt = `Analyze this homework or exam problem image. 
  Output ALL responses in ${langName}.
  1. Transcribe the question accurately.
  2. Solve the problem thoroughly step-by-step.
  3. Explain core concepts and analyze potential mistakes.
  4. Suggest tags.
  5. If it involves geometry or graphs, provide simple lightweight SVG code to visualize it.
  ${userHint ? `User Note: ${userHint}` : ''}`;

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
          maxOutputTokens: 8192,
          // Explicitly set safety settings to BLOCK_NONE to avoid filtering educational content (e.g. biology, history)
          safetySettings: [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });

      if (response.text) {
        const result = safeJsonParse<AIAnalysisResult>(response.text);
        // Inject token usage
        if (response.usageMetadata) {
            result.tokenUsage = {
                promptTokenCount: response.usageMetadata.promptTokenCount || 0,
                candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
                totalTokenCount: response.usageMetadata.totalTokenCount || 0
            };
        }
        return result;
      }
      
      console.error("Empty Response", JSON.stringify(response, null, 2));
      throw new Error("No response text from Gemini. The model might have filtered the content.");
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      throw error;
    }
  });
};

export const generateSimilarQuestion = async (originalQuestion: string, originalAnalysis: string, language: Language = 'ja'): Promise<AISimilarQuestionResult> => {
    const modelId = "gemini-2.5-flash";
    const ai = getAI();

    const langName = language === 'en' ? 'English' : language === 'zh' ? 'Chinese (Simplified)' : 'Japanese';

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING, description: "A new similar practice question." },
            answer: { type: Type.STRING, description: "Correct answer and short explanation for the new question." },
            svgDiagram: { type: Type.STRING, description: "SVG code for the new question if needed. Empty string if not." }
        },
        required: ["question", "answer"]
    };

    const prompt = `Based on Original Question: "${originalQuestion}" and Analysis: "${originalAnalysis || ''}", create a NEW similar practice problem to test understanding. 
    Output ALL responses in ${langName}.
    Change numbers or context but test the same concept. 
    Include SVG code if geometry/graphs are involved.`;

    return withRetry(async () => {
        try {
            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    maxOutputTokens: 8192,
                    safetySettings: [
                         { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                         { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                         { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                         { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ]
                }
            });

            if (response.text) {
                const result = safeJsonParse<AISimilarQuestionResult>(response.text);
                if (response.usageMetadata) {
                    result.tokenUsage = {
                        promptTokenCount: response.usageMetadata.promptTokenCount || 0,
                        candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
                        totalTokenCount: response.usageMetadata.totalTokenCount || 0
                    };
                }
                return result;
            }
            throw new Error("No response text");
        } catch (error) {
            console.error("Gemini Generation Error:", error);
            throw error;
        }
    });
}
