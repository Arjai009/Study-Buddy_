import React, { useState, useEffect } from 'react';
import StudyBuddy from './components/StudyBuddy';
import QuizMaker from './components/QuizMaker';
import ProjectHelper from './components/ProjectHelper';
import Settings from './components/Settings';
import Login from './components/Login';
import Chat from './components/Chat';
import FloatingTools from './components/FloatingTools';
import { UserSettings, ClassLevel, QuizResult, Bookmark } from './types';
import { db } from './services/db';
import { BookOpen, HelpCircle, PenTool, MessageCircle, Bookmark as BookmarkIcon, Trash, Loader2, Library, CheckSquare, Book, Settings as SettingsIcon, User, Search } from 'lucide-react';

type View = 'study' | 'quiz' | 'project' | 'chat' | 'bookmarks';
type LibraryTab = 'saved' | 'todo' | 'diary' | 'settings';

const App: React.FC = () => {
  const [view, setView] = useState<View>('study');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('saved');
  const [init, setInit] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({ 
    darkMode: false, 
    name: '', 
    username: '',
    email: '',
    classLevel: '10', 
    isAuthenticated: false,
    quizHistory: [],
    bookmarks: []
  });

  useEffect(() => {
    const loadSession = async () => {
        const session = await db.getSession();
        if (session) {
            setSettings(session);
        }
        setInit(true);
    };
    loadSession();
  }, []);
  
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (updated.isAuthenticated) {
        await db.updateProfile(updated);
    }
  };

  const handleLogin = async (name: string, email: string, username: string, classLevel: ClassLevel) => {
    const user = await db.login(name, email, username, classLevel);
    setSettings(user);
  };

  const handleLogout = async () => {
    await db.logout();
    setSettings(prev => ({ ...prev, isAuthenticated: false }));
    setView('study');
  };

  const handleQuizComplete = async (result: QuizResult) => {
    const newHistory = [...settings.quizHistory, result];
    await updateSettings({ quizHistory: newHistory });
  };

  const handleBookmark = async (bookmark: Bookmark) => {
    const newBookmarks = [bookmark, ...(settings.bookmarks || [])];
    await updateSettings({ bookmarks: newBookmarks });
  };

  const deleteBookmark = async (id: string) => {
    const newBookmarks = settings.bookmarks.filter(b => b.id !== id);
    await updateSettings({ bookmarks: newBookmarks });
  };

  if (!init) {
      return (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          </div>
      )
  }

  // --- LOGIN VIEW ---
  if (!settings.isAuthenticated) {
    return (
        <div className="w-full h-full md:h-[850px] md:max-w-[420px] md:rounded-[3rem] bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden relative border-[8px] border-gray-900 dark:border-gray-800">
            <Login onLogin={handleLogin} />
        </div>
    );
  }

  const MobileNavButton = ({ target, icon: Icon, label }: { target: View, icon: any, label: string }) => {
    const isActive = view === target;
    return (
      <button 
        onClick={() => setView(target)}
        className={`group flex flex-col items-center justify-center flex-1 py-1 transition-all ${isActive ? 'scale-105' : 'hover:opacity-70'}`}
      >
        <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-400 dark:text-gray-500'}`}>
             <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
      </button>
    )
  }

  // --- MAIN APP VIEW ---
  return (
    <div className="w-full h-full md:h-[850px] md:max-w-[420px] md:rounded-[3rem] bg-gray-50 dark:bg-gray-950 flex flex-col shadow-2xl relative overflow-hidden text-sm font-sans border-[8px] border-gray-900 dark:border-gray-800">
      
      {/* CONTENT AREA */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar relative w-full pb-24">
        
        {/* VIEW: STUDY */}
        <div className={view === 'study' ? 'block animate-fade-in h-full' : 'hidden'}>
           <StudyBuddy classLevel={settings.classLevel} onBookmark={handleBookmark} />
        </div>

        {/* VIEW: QUIZ */}
        <div className={view === 'quiz' ? 'block animate-fade-in h-full' : 'hidden'}>
           <QuizMaker classLevel={settings.classLevel} onQuizComplete={handleQuizComplete} history={settings.quizHistory} onBookmark={handleBookmark} />
        </div>

        {/* VIEW: PROJECT */}
        <div className={view === 'project' ? 'block animate-fade-in h-full' : 'hidden'}>
           <ProjectHelper classLevel={settings.classLevel} onBookmark={handleBookmark} />
        </div>
        
        {/* VIEW: CHAT */}
        <div className={view === 'chat' ? 'block animate-fade-in h-full' : 'hidden'}>
           <Chat user={settings} />
        </div>

        {/* VIEW: BOOKMARKS / LIBRARY */}
        {view === 'bookmarks' && (
            <div className="animate-fade-in min-h-full flex flex-col relative bg-gray-50 dark:bg-gray-900">
                {/* Header */}
                <div className="bg-white dark:bg-gray-900 p-6 sticky top-0 z-30 shadow-sm border-b border-gray-100 dark:border-gray-800 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Library</h2>
                        <p className="text-gray-500 text-xs font-semibold mt-1">Manage your study life</p>
                    </div>
                    {/* Settings Toggle Button */}
                    <button 
                        onClick={() => setLibraryTab(libraryTab === 'settings' ? 'saved' : 'settings')} 
                        className={`p-2.5 rounded-xl transition-all ${libraryTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-6">
                    {/* Inline Productivity Tabs */}
                    <div className="flex p-1.5 bg-gray-200 dark:bg-gray-800 rounded-2xl sticky top-24 z-20 overflow-x-auto no-scrollbar">
                        <button onClick={() => setLibraryTab('saved')} className={`flex-1 min-w-[70px] py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${libraryTab === 'saved' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <BookmarkIcon className="w-4 h-4"/> Saved
                        </button>
                        <button onClick={() => setLibraryTab('todo')} className={`flex-1 min-w-[70px] py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${libraryTab === 'todo' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <CheckSquare className="w-4 h-4"/> Tasks
                        </button>
                        <button onClick={() => setLibraryTab('diary')} className={`flex-1 min-w-[70px] py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${libraryTab === 'diary' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                            <Book className="w-4 h-4"/> Diary
                        </button>
                    </div>

                    {/* Content based on Tab */}
                    {libraryTab === 'saved' && (
                        <div className="space-y-4 animate-fade-in">
                             {!settings.bookmarks || settings.bookmarks.length === 0 ? (
                                <div className="text-center py-20 opacity-60 flex flex-col items-center">
                                    <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-full mb-4">
                                        <BookmarkIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-bold">Your library is empty</p>
                                </div>
                            ) : (
                                settings.bookmarks.slice().reverse().map((b) => (
                                    <div key={b.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 mr-4">
                                                <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg tracking-wider ${b.type === 'qa' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : b.type === 'paper' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                                    {b.type === 'qa' ? 'Answer' : b.type === 'paper' ? 'Paper' : 'Project'}
                                                </span>
                                                <h3 className="font-bold text-base mt-3 dark:text-white leading-tight line-clamp-2">{b.title}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1.5">{new Date(b.timestamp).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => deleteBookmark(b.id)} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash className="w-4 h-4"/></button>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl max-h-32 overflow-hidden relative">
                                            <p className="font-serif text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{b.content}</p>
                                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent"></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {(libraryTab === 'todo' || libraryTab === 'diary') && (
                        <FloatingTools username={settings.username} activeTab={libraryTab} />
                    )}

                    {libraryTab === 'settings' && (
                        <div className="animate-fade-in pb-10">
                            <Settings settings={settings} updateSettings={updateSettings} onLogout={handleLogout} />
                        </div>
                    )}
                </div>
            </div>
        )}

      </main>

      {/* --- Floating Bottom Navigation --- */}
      <nav className="absolute bottom-5 left-4 right-4 h-16 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl shadow-xl z-50 flex items-center justify-around px-2">
            <MobileNavButton target="study" icon={BookOpen} label="Ask" />
            <MobileNavButton target="quiz" icon={HelpCircle} label="Quiz" />
            <MobileNavButton target="project" icon={PenTool} label="Project" />
            <MobileNavButton target="chat" icon={MessageCircle} label="Chat" />
            <MobileNavButton target="bookmarks" icon={Library} label="Library" />
      </nav>

    </div>
  );
};

export default App;