export type ClassLevel = '9' | '10' | '11' | '12';

export type Subject = 
  | 'Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'History'
  | 'Civics'
  | 'Geography'
  | 'Economics'
  | 'English'
  | 'Hindi'
  | 'Sanskrit'
  | 'IT';

export type AnswerMode = 'Very Simple' | 'Exam Ready' | 'One-Line Answer';

export type ProjectType = 'ASL' | 'Practical File' | 'School Project / Assignment';

export interface StudySession {
  question: string;
  answer: string;
  timestamp: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResult {
  id: string;
  timestamp: number;
  subject: Subject;
  score: number;
  total: number;
}

export type BookmarkType = 'qa' | 'paper' | 'project';

export interface Bookmark {
  id: string;
  type: BookmarkType;
  title: string; // Question or Subject/Topic
  content: string; // The answer, paper body, or project body
  image?: string; // For projects with nano banana images
  timestamp: number;
}

export interface UserSettings {
  darkMode: boolean;
  name: string;
  username: string; // New: Unique ID 3-10 chars
  email: string;
  classLevel: ClassLevel;
  isAuthenticated: boolean;
  quizHistory: QuizResult[];
  bookmarks: Bookmark[]; // New: Saved content
}

export interface DirectoryUser {
  name: string;
  username: string;
  classLevel: ClassLevel;
}

// --- Chat Types ---

export interface ChatMessage {
  id: string;
  senderName: string;
  senderUsername: string; // Changed from Email to Username for ID
  content: string;
  timestamp: number;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[]; // usernames
  adminUsername: string;
  messages: ChatMessage[];
}

export interface PrivateChat {
  id: string;
  participants: string[]; // [username1, username2]
  messages: ChatMessage[];
}

export interface ChatRequest {
  id: string;
  fromUsername: string;
  fromName: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

// --- Productivity Types ---

export interface ToDoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  timestamp: number;
}