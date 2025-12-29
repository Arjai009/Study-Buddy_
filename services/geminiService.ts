import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- ROBUST KEY MANAGEMENT ---

// Fallback keys in case environment variables are missing
const FALLBACK_KEYS = "AIzaSyCS9B5j02Txn26poBnIL-MPLjd2sPTWDr4,AIzaSyABMTo2OZVul5QUK9J7hG_Mc4-Au8Bcgog,AIzaSyBGvO4C1j7kFBs99PTIfgWutZ_MkW-1Hro,AIzaSyA-n0wpWHA8qgrIJfqHmrt_5PHqkf_JHEY,AIzaSyDlPrNzOtTAA1yWaIR6Y4gNiAK1l62wYoU";

// Helper to get env var safely
const getEnvKey = (key: string): string => {
  try {
    // Check process.env (Node/Bundler)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}
  
  try {
    // Check window.process.env (Browser Polyfill)
    if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env[key]) {
      return (window as any).process.env[key];
    }
  } catch (e) {}
  
  return "";
};

// Strategy: Concatenate ALL potential sources. 
// This prevents a bad env var (e.g. "INSERT_KEY_HERE") from blocking the fallback keys.
const CANDIDATE_KEYS = [
  getEnvKey('API_KEY'),
  getEnvKey('GEMINI_API_KEY'),
  getEnvKey('REACT_APP_API_KEY'),
  FALLBACK_KEYS
].join(",");

const API_KEYS = Array.from(new Set(
  CANDIDATE_KEYS
    .split(/[,;\n\s]+/) // Split by comma, newline, space
    .map(candidate => {
        if (!candidate) return null;
        const clean = candidate.replace(/['"]/g, '').trim();
        // Look for the standard Google API Key prefix
        const startIndex = clean.indexOf('AIzaSy');
        if (startIndex !== -1) {
            const key = clean.substring(startIndex);
            // Basic length check (Google keys are usually 39 chars)
            if (key.length >= 35) return key;
        }
        return null;
    })
    .filter(key => key !== null) as string[]
));

if (API_KEYS.length === 0) {
  console.error(`[Gemini Service] ❌ No valid keys found. Checked env vars and fallback.`);
}

const clientPool = API_KEYS.length > 0 
  ? API_KEYS.map(key => new GoogleGenAI({ apiKey: key }))
  : [new GoogleGenAI({ apiKey: "MISSING_KEY" })];

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

const MODEL_FALLBACKS = [
  'gemini-1.5-flash',       
  'gemini-1.5-flash-latest', 
  'gemini-2.0-flash'        
];

/**
 * EXTREME RETRY LOGIC
 */
async function generateWithRetry<T>(
  operation: (client: GoogleGenAI, model: string) => Promise<T>, 
  retries = Math.max(3, API_KEYS.length + 1), 
  baseDelay = 1000
): Promise<T> {
  let lastError: any;

  // Attempt Loop (Try different keys)
  for (let attempt = 0; attempt <= retries; attempt++) {
    const client = getRandomClient();

    // Model Loop (Try different models on the same key)
    for (const model of MODEL_FALLBACKS) {
      try {
        return await operation(client, model);
      } catch (error: any) {
        lastError = error;
        const msg = (error.message || "").toLowerCase();
        const status = error.status || error.response?.status;

        // Classification
        const isRateLimit = status === 429 || status === 503 || msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('busy');
        const isModelError = status === 404 || status === 400 || msg.includes('not found') || msg.includes('supported');
        const isAuthError = status === 401 || status === 403 || msg.includes('key') || msg.includes('api key') || msg.includes('permission');

        if (isModelError) {
          // Model issue? Try next model on same key
          continue; 
        }

        if (isRateLimit || isAuthError) {
          // Key issue? Break inner loop to switch keys
          console.warn(`Key failed (${isRateLimit ? 'Busy' : 'Auth/Invalid'}). Switching...`);
          break; 
        }

        throw error;
      }
    }

    // Wait before switching keys if we haven't exhausted attempts
    if (attempt < retries) {
       const delay = baseDelay * Math.pow(1.5, attempt); 
       await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Final Fallback: Prevent crash if all keys fail
  console.error("All AI keys exhausted or busy.");
  throw new Error("All AI keys are currently busy or invalid.");
}

const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Class 9 and Class 10, strictly following the NCERT syllabus.
Formatting rules:
- Explain step-by-step.
- Use bullet points where possible.
- STRICTLY DO NOT USE ASTERISKS (*) or MARKDOWN BOLDING.
- Use dashes (-) for bullet points.
- Keep the text plain and clean.
`;

const cleanText = (text: string | undefined): string => {
    if (!text) return "No response text generated.";
    // Remove all asterisks, markdown bold/italic syntax
    return text.replace(/\*/g, '').trim();
};

export const getStudyAnswer = async (
  question: string,
  subject: Subject,
  classLevel: ClassLevel,
  mode: AnswerMode
): Promise<string> => {
  if (API_KEYS.length === 0) return "⚠️ System Error: No valid API Keys found.";

  try {
    const prompt = `Class: ${classLevel}, Subject: ${subject}, Mode: ${mode}\nQuestion: ${question}`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION_BASE, temperature: 0.7 },
      });
    });

    return cleanText(response.text);

  } catch (error: any) {
    console.error("Gemini Failure:", error);
    return "⚠️ High Traffic: My servers are a bit busy right now. Please try asking again in a few seconds!";
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  if (API_KEYS.length === 0) return [];

  try {
    // Added Random Seed/ID to prompt to ensure uniqueness
    const prompt = `
      Generate 5 UNIQUE and FRESH MCQs for Class ${classLevel} ${subject} ${topic ? `on ${topic}` : ''}.
      Ensure these are different from previous sets if possible.
      Random Seed: ${Date.now()}-${Math.random()}
      Return ONLY valid JSON array: [{"question":"", "options":["","","",""], "correctAnswer":"", "explanation":""}]
    `;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION_BASE, responseMimeType: 'application/json' },
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
  if (API_KEYS.length === 0) return "Error: No API Keys configured.";

  try {
    const session = getCurrentSession();
    const prompt = `Create Project: ${type} for Class ${classLevel} ${subject}, Topic: ${topic}, Session: ${session}. Structure: Cover, Index, Content, Conclusion.`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION_BASE, maxOutputTokens: 8192 },
      });
    });

    return cleanText(response.text);
  } catch (error) {
    return "⚠️ High Traffic: Unable to generate project right now. Please try again later.";
  }
};

export const getSamplePaper = async (
  subject: Subject,
  classLevel: ClassLevel
): Promise<string> => {
  if (API_KEYS.length === 0) return "Error: No API Keys configured.";

  try {
    const session = getCurrentSession();
    const prompt = `Create CBSE Sample Paper (80 Marks) for Class ${classLevel} ${subject}, Session ${session}. Sections A-E. Answers at end.`;

    const response = await generateWithRetry(async (client, model) => {
      return await client.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION_BASE, maxOutputTokens: 8192 },
      });
    });

    return cleanText(response.text);
  } catch (error) {
    return "⚠️ High Traffic: Unable to generate paper right now. Please try again later.";
  }
};