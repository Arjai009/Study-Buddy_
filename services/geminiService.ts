import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// --- MULTI-KEY ARCHITECTURE ---
// 1. Parse the comma-separated keys from the environment
const RAW_KEYS = process.env.API_KEY || "";
const API_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(k => k.length > 0);

// 2. Initialize a pool of clients
// If no keys are found, create a dummy one to prevent crash (requests will fail gracefully)
const clientPool = API_KEYS.length > 0 
  ? API_KEYS.map(key => new GoogleGenAI({ apiKey: key }))
  : [new GoogleGenAI({ apiKey: "" })];

/**
 * Returns a random client from the pool.
 * With 5 keys, this distributes the load (~20% per key).
 */
const getRandomClient = () => {
  const randomIndex = Math.floor(Math.random() * clientPool.length);
  return clientPool[randomIndex];
};

const getCurrentSession = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  // Indian Academic Session Logic (starts April)
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

/**
 * ROBUST RETRY SYSTEM
 * If a key hits a Rate Limit (429) or Server Overload (503),
 * this function waits briefly and then retries using a *different* random client.
 */
async function generateWithRetry<T>(
  operation: (client: GoogleGenAI) => Promise<T>, 
  retries = 3, 
  baseDelay = 1000
): Promise<T> {
  try {
    // 1. Pick a key for this attempt
    const client = getRandomClient();
    return await operation(client);
  } catch (error: any) {
    // 2. Detect Exhaustion/Busy errors
    const isRateLimit = error.status === 429 || 
                        error.status === 503 ||
                        (error.message && error.message.includes('429')) ||
                        (error.message && error.message.includes('exhausted')) ||
                        (error.message && error.message.includes('overloaded'));
    
    // 3. Failover Logic
    if (retries > 0 && isRateLimit) {
      console.warn(`Key busy/exhausted. Switching keys... (${retries} retries left)`);
      
      // Wait a short delay before trying another key
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      
      // Recursive call: This naturally picks a new random client from the pool
      return generateWithRetry(operation, retries - 1, baseDelay * 1.5);
    }
    
    // If not a rate limit, or out of retries, throw the error
    throw error;
  }
}

// Optimized System Instruction for speed and cost efficiency
const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Classes 9, 10, 11, and 12, strictly following the NCERT syllabus. 

Rules you MUST follow:
1. Answer ONLY according to the NCERT syllabus.
2. For Class 9/10: Simple language, foundation focus.
3. For Class 11/12: Precise terminology, board-exam focus.
4. If outside syllabus: "This topic is beyond the Class [X] NCERT syllabus."
5. NO Markdown bolding (**text**) in output. Keep it plain text.
6. Be concise.

Format:
- Definition
- Step-by-step explanation
- Conclusion
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
      
      Provide a clean, structured answer.
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

    let text = response.text || "Sorry, I couldn't generate an answer.";
    text = text.replace(/\*\*/g, ''); // Remove bolding
    return text;
  } catch (error) {
    console.error("AI Error:", error);
    return "All AI systems are currently at maximum capacity. Please wait 1 minute and try again.";
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  try {
    const prompt = `
      Generate 5 MCQs. Class ${classLevel} ${subject}. ${topic ? 'Topic: ' + topic : ''}
      Return ONLY a JSON array:
      [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "..."}]
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
    const prompt = `
      Create Project Content.
      Class: ${classLevel}, Subject: ${subject}, Type: ${type}, Topic: ${topic}, Session: ${session}
      Structure: Cover, Index, Ack, Content, Conclusion.
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          maxOutputTokens: 8192, // High limit for projects
        },
      });
    });

    let text = response.text || "Failed to generate project.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Project Error", error);
    return "Project generation failed. Please try again.";
  }
};

export const getSamplePaper = async (
  subject: Subject,
  classLevel: ClassLevel
): Promise<string> => {
  try {
    const session = getCurrentSession();
    const prompt = `
      Create Sample Paper (80 Marks). Class ${classLevel} ${subject}. Session ${session}.
      Include Sections A-E. Add Answers at the end after "---".
    `;

    const response = await generateWithRetry(async (client) => {
      return await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          maxOutputTokens: 8192, // High limit for papers
        },
      });
    });

    let text = response.text || "Failed to generate paper.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Paper Error", error);
    return "Sample paper generation failed. Please try again.";
  }
};