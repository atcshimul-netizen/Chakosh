export interface QuestionOption {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string;
  score: number;
}

export interface Question {
  id: number;
  prompt: string;
  options: QuestionOption[];
}

export interface Personality {
  level: number;
  minScore: number;
  maxScore: number;
  emoji: string;
  title: string;
  description: string;
}

export type QuizStage = 'welcome' | 'quiz' | 'result';
