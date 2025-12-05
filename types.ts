
export enum Subject {
  KOKUGO = '国語',
  SANSU = '算数',
  RIKA = '理科',
  SHAKAI = '社会',
  OTHER = 'その他'
}

export enum MasteryLevel {
  NEW = '未習得',         // Just added
  REVIEWING = '復習中', // Looked at it a few times
  MASTERED = '完了'   // Confident
}

export type Language = 'ja' | 'en' | 'zh';

export interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface MistakeItem {
  id: string;
  createdAt: number;
  imageUrl?: string; // URL from Cloud Storage or Base64 (Local)
  imageBase64?: string; // New field: Backup Base64 for AI Analysis (Bypasses CORS)
  questionText: string;
  userNotes?: string;
  userCorrectAnswer?: string; 
  reflection?: string; 
  reflectionImage?: string; 
  
  // AI Generated fields
  aiSolution?: string;
  aiAnalysis?: string;
  aiDiagram?: string; 
  aiTokenUsage?: TokenUsage;
  tags: string[];
  
  subject: Subject;
  mastery: MasteryLevel;
  reviewCount: number;
}

export interface AIAnalysisResult {
  questionText: string;
  solution: string;
  analysis: string;
  tags: string[];
  suggestedSubject: string;
  svgDiagram?: string; 
  tokenUsage?: TokenUsage;
}

export interface AISimilarQuestionResult {
  question: string;
  answer: string;
  svgDiagram?: string; 
  tokenUsage?: TokenUsage;
}
