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

export interface MistakeItem {
  id: string;
  createdAt: number;
  imageUrl?: string; // Base64 of the problem image
  questionText: string;
  userNotes?: string;
  userCorrectAnswer?: string; // New field for manual answer
  reflection?: string; // New field for student self-reflection
  reflectionImage?: string; // New field for handwritten reflection
  
  // AI Generated fields (Optional now, as they are generated on demand)
  aiSolution?: string;
  aiAnalysis?: string;
  aiDiagram?: string; // New field for SVG diagram
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
  svgDiagram?: string; // Optional SVG code
}

export interface AISimilarQuestionResult {
  question: string;
  answer: string;
  svgDiagram?: string; // Optional SVG code for the new question
}