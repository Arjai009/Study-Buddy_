import React, { useState } from 'react';
import { Subject, ClassLevel, QuizQuestion, QuizResult, Bookmark } from '../types';
import { SUBJECTS } from '../constants';
import { getQuizQuestions, getSamplePaper } from '../services/geminiService';
import { Loader2, BrainCircuit, RefreshCw, CheckCircle, XCircle, Trophy, History, FileText, Download, Printer, Bookmark as BookmarkIcon, ChevronDown, ArrowLeft, HelpCircle } from 'lucide-react';

interface QuizMakerProps {
  classLevel: ClassLevel;
  onQuizComplete: (result: QuizResult) => void;
  onBookmark: (b: Bookmark) => void;
  history: QuizResult[];
}

type Mode = 'mcq' | 'paper';

const QuizMaker: React.FC<QuizMakerProps> = ({ classLevel, onQuizComplete, history, onBookmark }) => {
  const [mode, setMode] = useState<Mode>('mcq');
  const [subject, setSubject] = useState<Subject>('Mathematics');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  
  // MCQ State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  // Paper State
  const [paperContent, setPaperContent] = useState<string | null>(null);

  const [view, setView] = useState<'setup' | 'quiz' | 'result' | 'history' | 'paper_view'>('setup');

  const handleGenerate = async () => {
    if (!subject) return;
    setLoading(true);
    
    if (mode === 'mcq') {
        const qs = await getQuizQuestions(subject, classLevel, topic || undefined);
        if (qs && qs.length > 0) {
            setQuestions(qs);
            setCurrentQIndex(0);
            setScore(0);
            setView('quiz');
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            alert("Failed to generate valid questions. Please try again.");
        }
    } else {
        const content = await getSamplePaper(subject, classLevel);
        setPaperContent(content);
        setView('paper_view');
    }
    
    setLoading(false);
  };

  const handleExportDoc = () => {
      if (!paperContent) return;
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${subject} Sample Paper</title></head><body>`;
      const footer = "</body></html>";
      const sourceHTML = header + `<div style="font-family: 'Times New Roman', serif; white-space: pre-wrap;"><h1 style="text-align: center;">Study Buddy - Sample Paper</h1><p style="text-align: center;"><strong>Subject:</strong> ${subject} | <strong>Class:</strong> ${classLevel}</p><hr/>${paperContent.replace(/\n/g, '<br/>')}</div>` + footer;
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${subject}_Sample_Paper.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

  const handleSavePaper = () => {
      if(paperContent) {
          onBookmark({
              id: Date.now().toString(),
              type: 'paper',
              title: `Sample Paper: ${subject}`,
              content: paperContent,
              timestamp: Date.now()
          });
          alert("Sample Paper saved to Bookmarks!");
      }
  };

  // ... MCQ Logic ...
  const handleOptionClick = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);
    if (option === questions[currentQIndex].correctAnswer) setScore(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      const finalScore = score + (selectedOption === questions[currentQIndex].correctAnswer ? 0 : 0);
      const result: QuizResult = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        subject,
        score: score,
        total: questions.length
      };
      onQuizComplete(result);
      setView('result');
    }
  };

  // ... Views ...

  if (view === 'paper_view') {
      return (
          <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
               <div className="p-4 sticky top-0 z-30 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
                  <button onClick={() => setView('setup')} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200"><ArrowLeft className="w-5 h-5 dark:text-white"/></button>
                  <h2 className="text-lg font-bold dark:text-white">Paper Preview</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-28">
                  <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[500px] text-gray-900 dark:text-gray-200 font-serif text-base leading-relaxed mb-6">
                      <pre className="whitespace-pre-wrap">{paperContent}</pre>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                      <button onClick={handleSavePaper} className="px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95">
                          <BookmarkIcon className="w-4 h-4" /> Save
                      </button>
                      <button onClick={handleExportDoc} className="px-5 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-all active:scale-95">
                          <Download className="w-4 h-4" /> Word
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  if (view === 'history') {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
         <div className="bg-white dark:bg-gray-900 p-6 sticky top-0 z-30 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 shrink-0">
             <button onClick={() => setView('setup')} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200"><ArrowLeft className="w-5 h-5 dark:text-white"/></button>
             <h2 className="text-2xl font-black text-gray-900 dark:text-white">History</h2>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
           {history.length === 0 ? (
             <div className="text-center py-20 flex flex-col items-center opacity-50">
                <History className="w-12 h-12 mb-4 text-gray-400"/>
                <p className="text-gray-500 font-bold">No quizzes taken yet.</p>
             </div>
           ) : (
             history.slice().reverse().map((h) => (
               <div key={h.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                 <div>
                   <h3 className="font-bold text-lg text-gray-800 dark:text-white">{h.subject}</h3>
                   <p className="text-xs text-gray-400 font-bold mt-1">{new Date(h.timestamp).toLocaleDateString()}</p>
                 </div>
                 <div className="text-right">
                   <span className={`text-2xl font-black ${h.score/h.total > 0.7 ? 'text-green-500' : 'text-orange-500'}`}>{h.score}<span className="text-sm text-gray-400">/{h.total}</span></span>
                 </div>
               </div>
             ))
           )}
         </div>
      </div>
    )
  }

  if (view === 'result') {
    return (
      <div className="flex flex-col justify-center h-full p-6 animate-fade-in text-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-indigo-50 dark:border-gray-700">
           <div className="inline-flex p-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 mb-6 shadow-sm">
             <Trophy className="w-16 h-16" />
           </div>
           <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Quiz Completed!</h2>
           <p className="text-gray-500 font-medium mb-8">Great effort on that quiz.</p>
           
           <div className="text-7xl font-black text-indigo-600 dark:text-indigo-400 mb-8 tracking-tighter">{score} <span className="text-2xl text-gray-300 font-bold">/ {questions.length}</span></div>
           
           <div className="flex gap-4 justify-center">
             <button onClick={() => setView('setup')} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3.5 px-8 rounded-2xl transition-colors">Done</button>
             <button onClick={handleGenerate} className="bg-indigo-600 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors">Retry</button>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'quiz') {
    const q = questions[currentQIndex];
    return (
      <div className="flex flex-col h-full p-4 overflow-hidden relative">
        <div className="flex justify-between items-center mb-6 px-2 shrink-0 z-20">
             <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">Q{currentQIndex + 1} of {questions.length}</span>
             <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold">Score: {score}</span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 flex-1 flex flex-col overflow-y-auto custom-scrollbar relative z-10">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8 leading-snug">{q.question}</h3>
          
          <div className="space-y-3 mb-8">
            {q.options.map((opt, idx) => {
              let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all relative text-sm font-bold ";
              if (!isAnswered) {
                btnClass += "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 dark:text-white hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20";
              } else {
                if (opt === q.correctAnswer) btnClass += "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/40 dark:text-green-200 dark:border-green-500/50";
                else if (opt === selectedOption) btnClass += "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/40 dark:text-red-200 dark:border-red-500/50";
                else btnClass += "opacity-40 bg-gray-50 dark:bg-gray-800 border-transparent dark:text-gray-400";
              }
              return (
                <button key={idx} onClick={() => handleOptionClick(opt)} disabled={isAnswered} className={btnClass}>
                  <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isAnswered && opt === q.correctAnswer ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-300 shadow-sm'}`}>{String.fromCharCode(65 + idx)}</span>
                      <span>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
          
          {isAnswered && (
            <div className="mt-auto animate-fade-in-up pb-20">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4 text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900/30">
                <span className="font-bold block mb-1 uppercase text-xs tracking-wider opacity-70">Explanation</span> {q.explanation}
              </div>
              <button onClick={nextQuestion} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-xl shadow-lg text-lg hover:opacity-90 transition-opacity">
                {currentQIndex < questions.length - 1 ? "Next Question" : "See Results"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup View
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-6 py-4 shadow-sm border-b border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                Quiz Center
            </h1>
            <p className="text-gray-500 text-xs font-semibold">Test your knowledge</p>
          </div>
          <button onClick={() => setView('history')} className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-colors">
             <History className="w-5 h-5 text-gray-600 dark:text-gray-300" />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center pb-28">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800">
            {/* Mode Switcher */}
            <div className="flex p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8">
                <button 
                    onClick={() => setMode('mcq')}
                    className={`flex-1 py-3 text-center rounded-xl font-bold transition-all text-sm ${mode === 'mcq' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    MCQ Challenge
                </button>
                <button 
                    onClick={() => setMode('paper')}
                    className={`flex-1 py-3 text-center rounded-xl font-bold transition-all text-sm ${mode === 'paper' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    Sample Paper
                </button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-2 ml-1">Subject</label>
                <div className="relative">
                    <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as Subject)}
                    className="w-full p-4 pl-4 pr-10 appearance-none rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:bg-white dark:focus:bg-gray-700 outline-none text-base font-bold transition-all border border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-4.5 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {mode === 'mcq' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-2 ml-1">Topic (Optional)</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Algebra..."
                      className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:bg-white dark:focus:bg-gray-700 outline-none text-base font-medium transition-all border border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400"
                    />
                  </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex justify-center items-center gap-3 disabled:opacity-50 text-base active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (mode === 'mcq' ? <BrainCircuit className="w-5 h-5"/> : <FileText className="w-5 h-5"/>)}
              {loading ? "Generating..." : (mode === 'mcq' ? "Start Quiz" : "Generate Paper")}
            </button>
          </div>
      </div>
    </div>
  );
};

export default QuizMaker;