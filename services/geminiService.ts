import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- ROBUST KEY MANAGEMENT ---

// 1. Get the raw string from various possible env vars
const RAW_KEYS = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.REACT_APP_API_KEY || "";

// 2. "Silver Bullet" Parsing Strategy
// Instead of trying to remove specific prefixes, we find the start of the key ("AIzaSy")
// and extract from there. This handles "GEMINI_API_KEY=AIzaSy...", quotes, spaces, etc.
const API_KEYS = RAW_KEYS
  .split(/[,;\n\s]+/) // Split by any separator
  .map(candidate => {
      // Clean quotes
      const clean = candidate.replace(/['"]/g, '').trim();
      
      // Find where the actual key starts (Google keys always start with AIzaSy)
      const startIndex = clean.indexOf('AIzaSy');
      
      // If found, extract from that point to the end
      if (startIndex !== -1) {
          return clean.substring(startIndex);
      }
      return null;
  })
  .filter(key => key !== null && key.length > 30) as string[];

// Log status to console (masked)
if (API_KEYS.length > 0) {
  console.log(`[Gemini Service] ✅ Successfully loaded ${API_KEYS.length} valid keys.`);
} else {
  // Helpful debug info
  console.error(`[Gemini Service] ❌ No valid keys found.`);
  console.error(`Raw input length: ${RAW_KEYS.length}`);
  console.error(`Tip: Ensure your keys start with 'AIzaSy'.`);
}

// Create a pool of clients
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
// 1. 'gemini-1.5-flash': MOST STABLE, Standard Tier. Use this first.
// 2. 'gemini-2.0-flash': Faster, smarter, but experimental.
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
`;

export const getStudyAnswer = async (
  question: string,
  subject: Subject,
  classLevel: ClassLevel,
  mode: AnswerMode
): Promise<string> => {
  // --- USER HELP MESSAGES ---
  if (API_KEYS.length === 0) {
      return "⚠️ Configuration Error: No valid API Keys found. Ensure you have pasted keys starting with 'AIzaSy'.";
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
        return "⚠️ Key Error: The API Key is invalid or expired. Please check your settings.";
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