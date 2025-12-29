import React, { useState, useRef, useEffect } from 'react';
import { SUBJECTS, MODES } from '../constants';
import { Subject, ClassLevel, AnswerMode, Bookmark } from '../types';
import { getStudyAnswer } from '../services/geminiService';
import { Send, Sparkles, AlertCircle, Trash2, Bookmark as BookmarkIcon, ChevronDown, GraduationCap, BookOpen, User, Bot, Loader2 } from 'lucide-react';

interface StudyBuddyProps {
  classLevel: ClassLevel;
  onBookmark: (b: Bookmark) => void;
}

const StudyBuddy: React.FC<StudyBuddyProps> = ({ classLevel, onBookmark }) => {
  const [subject, setSubject] = useState<Subject>('Mathematics');
  const [mode, setMode] = useState<AnswerMode>('Exam Ready');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when answer arrives or loading starts
    if ((answer || loading) && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answer, loading]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }
    setError(null);
    setLoading(true);
    setAnswer(null);
    setLastQuestion(question);
    
    // Clear input immediately for better UX
    setQuestion('');

    const result = await getStudyAnswer(question, subject, classLevel, mode);
    setAnswer(result);
    setLoading(false);
  };

  const handleSave = () => {
    if (answer && lastQuestion) {
      onBookmark({
        id: Date.now().toString(),
        type: 'qa',
        title: lastQuestion,
        content: answer,
        timestamp: Date.now()
      });
      alert('Answer saved to Bookmarks!');
    }
  };

  const clear = () => {
    setQuestion('');
    setAnswer(null);
    setLastQuestion(null);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* 1. Header - Sticky Top */}
      <div className="bg-white dark:bg-gray-900 px-6 py-4 shadow-sm border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-20 shrink-0">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                Ask AI
                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">v2.1</span>
            </h1>
            <p className="text-gray-500 text-xs font-semibold">Class {classLevel} Assistant</p>
          </div>
          
          <div className="flex gap-2">
             <div className="relative group">
                <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as Subject)}
                    className="appearance-none bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 pl-3 pr-8 py-2 rounded-xl text-xs font-bold outline-none transition-all cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                >
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-3 h-3 text-gray-400 pointer-events-none" />
             </div>
             <div className="relative hidden md:block group">
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as AnswerMode)}
                    className="appearance-none bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 pl-3 pr-8 py-2 rounded-xl text-xs font-bold outline-none transition-all cursor-pointer"
                >
                    {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-3 h-3 text-indigo-400 pointer-events-none" />
             </div>
          </div>
      </div>

      {/* 2. Chat Area - Independent Scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-6 relative">
        
        {/* Empty State */}
        {!answer && !loading && !lastQuestion && (
            <div className="flex flex-col items-center justify-center h-full opacity-100 space-y-4">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none animate-fade-in-up">
                    <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="text-center animate-fade-in-up delay-100">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Hello Student!</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2 font-medium">I'm ready to help you ace your {subject} exams. Ask me anything!</p>
                </div>
            </div>
        )}

        {/* User Question */}
        {lastQuestion && (
            <div className="flex justify-end animate-fade-in-up">
                <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md text-sm font-medium leading-relaxed">
                    {lastQuestion}
                </div>
            </div>
        )}

        {/* AI Answer */}
        {(loading || answer) && (
            <div className="flex justify-start animate-fade-in-up w-full pb-4">
                <div className="flex gap-3 max-w-full items-start">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm mt-1">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex-1 min-w-0">
                        {loading ? (
                            <div className="flex items-center gap-3 text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                <span className="text-sm font-bold animate-pulse text-indigo-600">Thinking...</span>
                            </div>
                        ) : (
                            <>
                                <div className="prose dark:prose-invert max-w-none prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-headings:text-gray-900 dark:prose-headings:text-white text-sm leading-relaxed">
                                    {answer?.split('\n').map((line, i) => (
                                        <div key={i} className={`mb-2 ${line.trim() === '' ? 'h-2' : ''}`}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                     <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-colors">
                                        <BookmarkIcon className="w-3.5 h-3.5" /> Save
                                     </button>
                                     <button onClick={clear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 text-xs font-bold text-gray-600 dark:text-gray-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Clear
                                     </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* 3. Footer Input - Fixed */}
      <div className="shrink-0 z-30 p-4 pb-24 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent dark:from-gray-950 dark:via-gray-950">
        <form onSubmit={handleAsk} className="relative">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-200 dark:border-gray-700 flex items-center p-2 pl-4 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 shadow-xl">
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Type your question..."
                    className="flex-1 bg-transparent max-h-32 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 outline-none resize-none py-3 pr-2"
                    rows={1}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAsk(e);
                        }
                    }}
                />
                <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shrink-0"
                >
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Send className="w-4 h-4 ml-0.5" />}
                </button>
            </div>
        </form>
        {error && <p className="text-red-500 text-xs font-bold mt-2 text-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm py-1 rounded-lg shadow-sm inline-block mx-auto w-full">{error}</p>}
      </div>
    </div>
  );
};

export default StudyBuddy;