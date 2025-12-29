import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- ROBUST KEY MANAGEMENT ---

// 1. Get the raw string from env
const RAW_KEYS = process.env.API_KEY || "";

// 2. Advanced Parsing:
// - Split by comma, semicolon, newline, or pipe
// - Remove any quotes (" or ') that might have been pasted
// - Trim whitespace
// - Filter out empty or too short strings
const API_KEYS = RAW_KEYS
  .replace(/['"]/g, '') // Remove quotes
  .split(/[,;\n|]+/)    // Split by delimiters
  .map(k => k.trim())   // Remove spaces
  .filter(k => k.length > 10); // Check for valid key length

// Log (safely) to console for debugging
console.log(`[Gemini Service] Loaded ${API_KEYS.length} API Keys.`);

// Create a pool of clients
// If no keys found, we create a dummy one. The API will throw an error, but the app won't crash on load.
const clientPool = API_KEYS.length > 0 
  ? API_KEYS.map(key => new GoogleGenAI({ apiKey: key }))
  : [new GoogleGenAI({ apiKey: "MISSING_KEY" })];

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
// We prioritize the new Flash 3 model, but fallback to 1.5 Flash (Standard) if 3 is not enabled for the key.
const MODEL_FALLBACKS = [
  'gemini-2.0-flash',        // Newest fast model
  'gemini-1.5-flash',        // Most stable standard model
  'gemini-1.5-flash-latest'  // Backup alias
];

/**
 * EXTREME RETRY LOGIC
 * Dynamic retries based on key count. 
 * If you have 5 keys, we try at least 6 times to ensure we rotate through them if some are busy.
 */
async function generateWithRetry<T>(
  operation: (client: GoogleGenAI, model: string) => Promise<T>, 
  // Dynamic default: At least 3, or KeyCount + 1 to ensure rotation coverage
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
        const isAuthError = status === 401 || status === 403 || msg.includes('key') || msg.includes('api key');

        if (isModelError) {
          // Model doesn't exist? Try the next older model with the SAME key
          continue; 
        }

        if (isRateLimit || isAuthError) {
          // Key is busy or invalid? Break inner loop to try a NEW KEY
          console.warn(`Key issue (${isRateLimit ? 'Busy' : 'Invalid'}). Switching keys...`);
          break; 
        }

        // Unknown error? Throw immediately
        throw error;
      }
    }

    // If we are here, the key failed. Wait before trying next key.
    if (attempt < retries) {
       const delay = baseDelay * Math.pow(1.5, attempt); // Exponential backoff
       await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Class 9 and Class 10, strictly following the NCERT syllabus.

Rules you MUST follow:
1. Answer ONLY according to Class 9 and Class 10 NCERT syllabus.
2. Use simple, clear language suitable for school students.
3. Do NOT use college-level or advanced terminology.
4. Be exam-oriented and board-focused.
5. If the question is outside Class 9 or 10 syllabus, clearly say:
   "This topic is beyond the Class 9/10 NCERT syllabus."
6. NO Markdown bolding (**text**) in output. Keep it plain text for cleanliness.

Formatting rules:
- Start with a short definition (if applicable).
- Explain step-by-step.
- Use bullet points where possible.
- Highlight important keywords (using capitalization, not bolding).
- For long answers, end with a brief conclusion.

Subject-specific rules:
- Maths: Show all steps clearly in board-exam format.
- Physics/Chemistry: Use formulas, definitions, and examples.
- Biology: Explain processes simply; mention diagrams in words if needed.
- History/Civics/Geography/Economics: Use short paragraphs, factual, textbook tone.
`;

export const getStudyAnswer = async (
  question: string,
  subject: Subject,
  classLevel: ClassLevel,
  mode: AnswerMode
): Promise<string> => {
  // Guard clause for missing keys
  if (API_KEYS.length === 0) {
      return "⚠️ Configuration Error: No API Keys found. Please set API_KEY in your environment variables.";
  }

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
    
    const msg = (error.message || "").toLowerCase();
    
    if (msg.includes("429") || msg.includes("quota")) {
        return "⚠️ High Traffic: All AI keys are currently busy. Please wait 10 seconds.";
    }
    if (msg.includes("key") || msg.includes("403") || msg.includes("401")) {
        return "⚠️ Configuration Error: The API Key is invalid. Check your .env file format (no quotes, comma separated).";
    }
    return `⚠️ System Error: ${msg.substring(0, 100)}`;
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  if (API_KEYS.length === 0) return [];

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
  if (API_KEYS.length === 0) return "Error: No API Keys configured.";

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
  if (API_KEYS.length === 0) return "Error: No API Keys configured.";

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