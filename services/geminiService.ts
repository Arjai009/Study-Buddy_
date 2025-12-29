import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- KEY ROTATION LOGIC ---
// Parse multiple keys from the environment variable (comma separated)
// Example Env Var: API_KEY="key1,key2,key3"
const API_KEYS = (process.env.API_KEY || "").split(',').map(k => k.trim()).filter(k => k.length > 0);

// Create a pool of clients
const clients = API_KEYS.length > 0 
  ? API_KEYS.map(key => new GoogleGenAI({ apiKey: key }))
  : [new GoogleGenAI({ apiKey: "" })]; // Fallback

/**
 * Gets a random client from the pool.
 * This effectively load balances requests across multiple free tier accounts.
 */
const getClient = () => {
  const randomIndex = Math.floor(Math.random() * clients.length);
  return clients[randomIndex];
};

const getCurrentSession = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11 (Jan is 0, April is 3)
  
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

/**
 * SMART RETRY LOGIC
 * Handles 429 (Rate Limit) errors by waiting or switching keys implicitly via retries.
 */
async function generateWithRetry<T>(
  operation: (client: GoogleGenAI) => Promise<T>, 
  retries = 3, 
  baseDelay = 2000
): Promise<T> {
  try {
    // Pick a client for this attempt
    const client = getClient();
    return await operation(client);
  } catch (error: any) {
    const isRateLimit = error.status === 429 || 
                        (error.message && error.message.includes('429')) ||
                        (error.message && error.message.includes('exhausted'));
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit on one key. Retrying with potential key switch... (${retries} left)`);
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      // Retry (getClient will likely pick a different key next time)
      return generateWithRetry(operation, retries - 1, baseDelay * 1.5);
    }
    throw error;
  }
}

const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Classes 9, 10, 11, and 12, strictly following the NCERT syllabus. 

Rules you MUST follow:
1. Answer ONLY according to the NCERT syllabus for the specified Class.
2. For Class 9/10: Use simple language, build strong foundations.
3. For Class 11/12: Use precise terminology and board-level explanations.
4. Be exam-oriented and board-focused.
5. If the question is outside the syllabus, clearly say: "This topic is beyond the Class [X] NCERT syllabus."
6. Do NOT use markdown bolding (asterisks like **text**) to keep output clean and readable.
7. Be concise and token-efficient while maintaining clarity.

Formatting rules:
- Start with a short definition.
- Explain step-by-step.
- Use bullet points.
`;

export const getStudyAnswer = async (
  question: string,
  subject: Subject,
  classLevel: ClassLevel,
  mode: AnswerMode
): Promise<string> => {
  try {
    const prompt = `
      Class: ${classLevel}
      Subject: ${subject}
      Mode: ${mode}
      Question: ${question}

      Instructions:
      - Very Simple: Simplest explanation.
      - Exam Ready: Board Exam format (5 marks).
      - One-Line: Precise 1-2 lines.
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          temperature: 0.7,
        },
      });
    });

    let text = response.text || "Sorry, I couldn't generate an answer. Please try again.";
    text = text.replace(/\*\*/g, ''); 
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "All AI servers are currently busy. Please wait a moment and try again.";
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  try {
    const prompt = `
      Generate 5 MCQ for Class ${classLevel} ${subject}.
      ${topic ? `Topic: ${topic}` : 'Topic: General NCERT'}
      
      Output strictly JSON array:
      [
        {
          "question": "Text",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "A", 
          "explanation": "Brief reason"
        }
      ]
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          responseMimeType: 'application/json',
        },
      });
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (error) {
    console.error("Quiz Gen Error", error);
    return [];
  }
};

export const getProjectContent = async (
  subject: Subject,
  type: ProjectType,
  topic: string,
  classLevel: ClassLevel
): Promise<string> => {
  try {
    const session = getCurrentSession();
    const prompt = `
      Create school project content.
      Class: ${classLevel}, Subject: ${subject}, Type: ${type}, Topic: ${topic}, Session: ${session}

      Structure:
      1. Cover Page Details
      2. Index
      3. Acknowledgement & Certificate
      4. Main Content (Detailed)
      5. Conclusion

      If invalid subject/type combo, state it.
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE + " Provide detailed, well-structured, ready-to-print output.",
          maxOutputTokens: 8192, 
        },
      });
    });

    let text = response.text || "Could not generate project content.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Project Gen Error", error);
    return "Server is busy. Please try again in a few moments.";
  }
};

export const getSamplePaper = async (
  subject: Subject,
  classLevel: ClassLevel
): Promise<string> => {
  try {
    const session = getCurrentSession();
    const prompt = `
      Create CBSE Sample Paper. Class ${classLevel} ${subject}. 80 Marks. Session ${session}.
      
      Sections:
      A: 5 MCQs (1 mark)
      B: 3 Short Qs (2 marks)
      C: 3 Short Qs (3 marks)
      D: 3 Long Qs (5 marks)
      E: 1 Case Study (4 marks)
      
      INCLUDE ANSWERS at the end.
      Use "---" separator between Paper and Answers.
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          maxOutputTokens: 8192,
        },
      });
    });

    let text = response.text || "Could not generate sample paper.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Sample Paper Error", error);
    return "Server is busy. Please try again in a few moments.";
  }
};