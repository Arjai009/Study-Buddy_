import { Subject, ClassLevel, AnswerMode } from './types';

export const SUBJECTS: Subject[] = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Civics',
  'Geography',
  'Economics',
  'English',
  'Hindi',
  'Sanskrit',
  'IT'
];

export const CLASSES: ClassLevel[] = ['9', '10', '11', '12'];

export const MODES: AnswerMode[] = ['Very Simple', 'Exam Ready', 'One-Line Answer'];

export const CREATOR_CREDIT = "Made by ARNAV JAISWAL";

// --- SUPABASE CONFIGURATION ---
// PASTE YOUR NEW KEYS HERE
export const SUPABASE_URL = "https://isyotjzilabszeytdhbh.supabase.co"; 
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeW90anppbGFic3pleXRkaGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODExMTAsImV4cCI6MjA4MjQ1NzExMH0.6ry_Mhk3IIv5AxBgiC8NYoXL9gI82aQvo98n2SkopYE";