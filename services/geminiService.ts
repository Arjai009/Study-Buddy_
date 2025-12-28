import { GoogleGenAI } from "@google/genai";
import { Subject, ClassLevel, AnswerMode, ProjectType, QuizQuestion } from "../types";

// Initialize the API client
// Safety check: Fallback to an empty string if API_KEY is missing.
// This prevents the app from crashing on load (white screen) if the environment variable isn't set.
// The actual API call will fail gracefully with a specific error message in the try/catch blocks.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const getCurrentSession = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11 (Jan is 0, April is 3)
  
  // In India/CBSE, new session usually starts in April.
  // If we are in Jan(0), Feb(1), or Mar(2), we are in the end of the previous starting year.
  // E.g., Jan 2025 -> Session 2024-25
  // April 2025 -> Session 2025-26
  
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

const SYSTEM_INSTRUCTION_BASE = `
You are an expert school teacher for CBSE Classes 9, 10, 11, and 12, strictly following the NCERT syllabus. 

Rules you MUST follow:
1. Answer ONLY according to the NCERT syllabus for the specified Class (9, 10, 11, or 12).
2. For Class 9/10: Use simple language, build strong foundations.
3. For Class 11/12: Use precise terminology, derivation (Physics), mechanisms (Chemistry), and detailed diagrams explanations (Biology) as per board level.
4. Be exam-oriented and board-focused.
5. If the question is outside the syllabus for the specific class, clearly say: "This topic is beyond the Class [X] NCERT syllabus."
6. Do NOT use markdown bolding (asterisks like **text**). Use plain text or capital letters for emphasis if strictly necessary. Keep the output clean.
7. Subject Handling:
   - If Subject is 'Civics' and Class is 11 or 12, treat it as 'Political Science'.
   - Treat 'IT' as Information Practices / Computer Science for 11/12.

Formatting rules:
- Start with a short definition (if applicable).
- Explain step-by-step.
- Use bullet points where possible.
- For long answers, end with a brief conclusion.

Subject-specific rules:
- Maths: Show all steps clearly in board-exam format. For 11/12, include necessary theorems/properties.
- Physics/Chemistry: Use formulas, definitions, and examples.
- Biology: Explain processes simply; mention diagrams in words if needed.
- SST (History/Pol.Sci/Geog/Eco): Use short paragraphs, avoid opinions, stick to textbook facts.
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

      Mode Instructions:
      - Very Simple Mode: Explain in the simplest possible way.
      - Exam Ready Mode: Format the answer exactly like a ${classLevel === '12' || classLevel === '10' ? 'Board Exam' : 'School Exam'} answer (approx 5 marks).
      - One-Line Answer Mode: Answer in one or two precise textbook-style lines only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_BASE,
      },
    });

    let text = response.text || "Sorry, I couldn't generate an answer. Please try again.";
    text = text.replace(/\*\*/g, ''); 
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error: Unable to connect to AI. Please check your API Key configuration.";
  }
};

export const getQuizQuestions = async (
  subject: Subject,
  classLevel: ClassLevel,
  topic?: string
): Promise<QuizQuestion[]> => {
  try {
    const prompt = `
      Generate 5 multiple-choice questions (MCQ) for CBSE Class ${classLevel} ${subject}.
      ${topic ? `Topic: ${topic}` : 'Topic: General important chapter from NCERT'}
      
      Return the response in strictly JSON format.
      The JSON should be an array of objects with the following structure:
      [
        {
          "question": "Question text here",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A", 
          "explanation": "Short explanation why it is correct"
        }
      ]
      Ensure "correctAnswer" matches exactly one string in the "options" array.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_BASE + " You are creating a JSON quiz.",
        responseMimeType: 'application/json',
      },
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
      Create a school project content.
      Class: ${classLevel}
      Subject: ${subject}
      Type: ${type}
      Topic: ${topic}
      Session: ${session}

      Rules:
      - Strictly Class ${classLevel} level.
      - Format exactly like a ready-to-submit school file.
      - Use Academic Session: ${session} in the Cover Page.
      - Include: Cover Page details, Index, Acknowledgement, Certificate, Main Content, Conclusion.
      
      Specific Type Rules:
      - ASL: Include Script/Dialogue/Questions.
      - Practical File: Aim, Apparatus, Theory, Procedure, Obs, Result.
      - Project/Assignment: Intro, Detailed Explanation, Conclusion.

      If the project type is not suitable for the subject, start with: "This project type is not applicable for the selected subject."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_BASE + " You are a helpful project guide.",
      },
    });

    let text = response.text || "Could not generate project content.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Project Gen Error", error);
    return "Error generating project content. Check API Key.";
  }
};

export const getSamplePaper = async (
  subject: Subject,
  classLevel: ClassLevel
): Promise<string> => {
  try {
    const session = getCurrentSession();
    const prompt = `
      Create a comprehensive CBSE Sample Paper for Class ${classLevel} ${subject}.
      Marks: 80
      Session: ${session}
      
      Structure:
      - Header: School Name (Placeholder), Subject, Class, Session: ${session}, Max Marks: 80, Time: 3 Hours.
      - General Instructions.
      - Section A: MCQs (1 mark each) - Provide 5 important ones.
      - Section B: Short Answer Type I (2 marks) - Provide 3.
      - Section C: Short Answer Type II (3 marks) - Provide 3.
      - Section D: Long Answer Type (5 marks) - Provide 3.
      - Section E: Case Based / Source Based (4 marks) - Provide 1.
      
      AFTER the questions, add a page break or separator line and provide the ANSWERS/SOLUTIONS for all questions.
      
      Format for clear reading and printing. Use "---" to separate Questions and Answers.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_BASE + " You are creating an exam paper.",
      },
    });

    let text = response.text || "Could not generate sample paper.";
    text = text.replace(/\*\*/g, '');
    return text;
  } catch (error) {
    console.error("Sample Paper Error", error);
    return "Error generating sample paper.";
  }
};