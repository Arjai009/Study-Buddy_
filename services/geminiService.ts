import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- ROBUST KEY MANAGEMENT ---
// Parse keys from various delimiters (comma, space, newline, semicolon)
const RAW_KEYS = process.env.API_KEY || "";
const API_KEYS = RAW_KEYS.split(/[,;\n\s]+/).map(k => k.trim()).filter(k => k.length > 5); // Basic length check

// Create a pool of clients
const clientPool = API_KEYS.length > 0 
  ? API_KEYS.map(key => new GoogleGenAI({ apiKey: key }))
  : [new GoogleGenAI({ apiKey: "" })]; // Fallback to empty key to show auth error from API

/**
 * Returns a random client to distribute load.
 */
const getRandomClient = () => {
  const randomIndex = Math.floor(Math.random() * clientPool.length);
  return clientPool[randomIndex];
};

const getCurrentSession = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); 
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// --- MODEL STRATEGY ---
// We try the best model first. If it fails (404/400), we try the next.
// 'gemini-3-flash-preview' is preferred but might not be active for all keys yet.
const MODEL_FALLBACKS = [
  'gemini-3-flash-preview',
  'gemini-2.0-flash-exp',
  'gemini-flash-latest'
];

/**
 * EXTREME RETRY LOGIC
 * 1. Rotates API Keys on 429/401 errors.
 * 2. Rotates Models on 404/400 errors (if model not found).
 * 3. Exponential backoff for rate limits.
 */
async function generateWithRetry<T>(
  operation: (client: GoogleGenAI, model: string) => Promise<T>, 
  retries = 3, 
  baseDelay = 2000
): Promise<T> {
  let lastError: any;

  // Try loop
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Pick a random client (key)
    const client = getRandomClient();

    // Try through models in order of preference
    for (const model of MODEL_FALLBACKS) {
      try {
        return await operation(client, model);
      } catch (error: any) {
        lastError = error;
        const msg = (error.message || "").toLowerCase();
        const status = error.status || error.response?.status;

        // ANALYSIS:
        // 429, 503, "quota", "exhausted" -> Rate Limit -> Try different Key (break model loop, continue attempt loop)
        // 404, "not found", "unsupported" -> Model Issue -> Try next Model (continue model loop)
        // 401, 403, "key" -> Auth Issue -> Try different Key (break model loop, continue attempt loop)

        const isRateLimit = status === 429 || status === 503 || msg.includes('429') || msg.includes('exhausted') || msg.includes('quota') || msg.includes('overloaded');
        const isModelError = status === 404 || status === 400 || msg.includes('not found') || msg.includes('supported');
        const isAuthError = status === 401 || status === 403 || msg.includes('key');

        if (isModelError) {
          console.warn(`Model ${model} failed. Trying fallback...`);
          continue; // Try next model in list with SAME key
        }

        if (isRateLimit || isAuthError) {
          console.warn(`Key failed (${isRateLimit ? 'Busy' : 'Auth'}). Switching key...`);
          break; // Break model loop to pick NEW KEY in outer loop
        }

        // If unknown error, throw immediately
        throw error;
      }
    }

    // If we are here, the current key failed all/some models due to Rate Limit/Auth.
    // Wait before trying next key
    if (attempt < retries) {
       const delay = baseDelay * Math.pow(2, attempt);
       console.log(`Waiting ${delay}ms before next attempt...`);
       await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Classes 9, 10, 11, and 12.
Rules:
1. Follow NCERT syllabus strictly.
2. Simple, clear language.
3. No Markdown bolding (**text**).
4. Be concise.
`;

export const getStudyAnswer = async (
  question: string,
  subject: Subject,
  classLevel: ClassLevel,
  mode: AnswerMode
): Promise<string> => {
  try {
    const prompt = `Class: ${classLevel}, Subject: ${subject}, Mode: ${mode}\nQuestion: ${question}`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          temperature: 0.7,
        },
      });
    });

    let text = response.text || "No response text generated.";
    text = text.replace(/\*\*/g, '');
    return text;

  } catch (error: any) {
    console.error("Gemini Critical Failure:", error);
    
    // Friendly Error Messages
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota")) {
        return "⚠️ High Traffic: All AI keys are currently busy. Please wait 30 seconds and try again.";
    }
    if (msg.includes("key") || msg.includes("403") || msg.includes("401")) {
        return "⚠️ Configuration Error: Invalid API Key. Please check your settings.";
    }
    return `⚠️ System Error: ${msg.substring(0, 60)}...`;
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  try {
    const prompt = `
      Generate 5 MCQs for Class ${classLevel} ${subject} ${topic ? `on ${topic}` : ''}.
      Return ONLY valid JSON array: [{"question":"", "options":["","","",""], "correctAnswer":"", "explanation":""}]
    `;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
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
    console.error("Quiz Error", error);
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
    const prompt = `Create Project: ${type} for Class ${classLevel} ${subject}, Topic: ${topic}, Session: ${session}. Structure: Cover, Index, Content, Conclusion.`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          maxOutputTokens: 8192,
        },
      });
    });

    let text = response.text || "Failed to generate project.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Project Error", error);
    return "Project generation failed due to high load. Please try again.";
  }
};

export const getSamplePaper = async (
  subject: Subject,
  classLevel: ClassLevel
): Promise<string> => {
  try {
    const session = getCurrentSession();
    const prompt = `Create CBSE Sample Paper (80 Marks) for Class ${classLevel} ${subject}, Session ${session}. Sections A-E. Answers at end.`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          maxOutputTokens: 8192,
        },
      });
    });

    let text = response.text || "Failed to generate paper.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Paper Error", error);
    return "Paper generation failed due to high load. Please try again.";
  }
};