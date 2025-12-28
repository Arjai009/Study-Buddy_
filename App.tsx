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
import { BookOpen, HelpCircle, PenTool, MessageCircle, Bookmark as BookmarkIcon, Trash, Loader2, Library, CheckSquare, Book, Settings as SettingsIcon, User } from 'lucide-react';

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
          <div className="h-full flex items-center justify-center bg-blue-50 dark:bg-gray-900">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          </div>
      )
  }

  if (!settings.isAuthenticated) {
    return (
        <div className="w-full max-w-[768px] h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
            <Login onLogin={handleLogin} />
        </div>
    );
  }

  const MobileNavButton = ({ target, icon: Icon, label }: { target: View, icon: any, label: string }) => {
    const isActive = view === target;
    return (
      <button 
        onClick={() => setView(target)}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95"
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white -translate-y-2 shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-gray-400 dark:text-gray-500'}`}>
             <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} strokeWidth={isActive ? 2 : 2} />
        </div>
        <span className={`text-[10px] font-bold mt-1 transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-400'}`}>{label}</span>
      </button>
    )
  }

  return (
    // MAIN CONTAINER - overflow-hidden prevents body scroll
    <div className="w-full max-w-[768px] bg-white dark:bg-gray-900 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden text-sm font-sans">
      
      {/* CONTENT AREA */}
      <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-gray-900 relative w-full pb-20">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none fixed"></div>
        
        {/* VIEW: STUDY */}
        <div className={view === 'study' ? 'block animate-fade-in h-full w-full' : 'hidden'}>
           <StudyBuddy classLevel={settings.classLevel} onBookmark={handleBookmark} />
        </div>

        {/* VIEW: QUIZ */}
        <div className={view === 'quiz' ? 'block animate-fade-in h-full w-full' : 'hidden'}>
           <QuizMaker classLevel={settings.classLevel} onQuizComplete={handleQuizComplete} history={settings.quizHistory} onBookmark={handleBookmark} />
        </div>

        {/* VIEW: PROJECT */}
        <div className={view === 'project' ? 'block animate-fade-in h-full w-full' : 'hidden'}>
           <ProjectHelper classLevel={settings.classLevel} onBookmark={handleBookmark} />
        </div>
        
        {/* VIEW: CHAT */}
        <div className={view === 'chat' ? 'block animate-fade-in h-full w-full' : 'hidden'}>
           <Chat user={settings} />
        </div>

        {/* VIEW: BOOKMARKS / LIBRARY */}
        {view === 'bookmarks' && (
            <div className="animate-fade-in h-full flex flex-col relative z-10 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0 shadow-lg flex justify-between items-center relative z-20">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Library className="w-6 h-6" /> Library
                        </h2>
                        <p className="text-blue-200 text-xs font-medium ml-8 opacity-80">Your Personal Space</p>
                    </div>
                    {/* Settings Toggle Button */}
                    <button 
                        onClick={() => setLibraryTab(libraryTab === 'settings' ? 'saved' : 'settings')} 
                        className={`p-2 rounded-full transition-all ${libraryTab === 'settings' ? 'bg-white text-blue-600 shadow-lg' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        title="Settings"
                    >
                        <SettingsIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 pb-24">
                    {/* Inline Productivity Tabs */}
                    <div className="flex p-1 bg-white dark:bg-gray-800 rounded-xl sticky top-0 z-20 shadow-sm border border-blue-50 dark:border-gray-700 overflow-x-auto no-scrollbar shrink-0">
                        <button onClick={() => setLibraryTab('saved')} className={`flex-1 min-w-[70px] py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryTab === 'saved' ? 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-md text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            <Library className="w-4 h-4"/> Saved
                        </button>
                        <button onClick={() => setLibraryTab('todo')} className={`flex-1 min-w-[70px] py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryTab === 'todo' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-md text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            <CheckSquare className="w-4 h-4"/> Tasks
                        </button>
                        <button onClick={() => setLibraryTab('diary')} className={`flex-1 min-w-[70px] py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryTab === 'diary' ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-md text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            <Book className="w-4 h-4"/> Diary
                        </button>
                        <button onClick={() => setLibraryTab('settings')} className={`flex-1 min-w-[70px] py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryTab === 'settings' ? 'bg-gradient-to-r from-gray-700 to-gray-600 shadow-md text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            <User className="w-4 h-4"/> Profile
                        </button>
                    </div>

                    {/* Content based on Tab */}
                    {libraryTab === 'saved' && (
                        <div className="space-y-4 animate-fade-in">
                             {!settings.bookmarks || settings.bookmarks.length === 0 ? (
                                <div className="text-center py-24 bg-white dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center opacity-70">
                                    <BookmarkIcon className="w-16 h-16 text-gray-200 dark:text-gray-600 mb-4" />
                                    <p className="text-gray-400 font-bold text-lg">Nothing saved yet</p>
                                    <p className="text-gray-300 text-xs">Bookmarks appear here</p>
                                </div>
                            ) : (
                                settings.bookmarks.slice().reverse().map((b) => (
                                    <div key={b.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-blue-50 dark:border-gray-700 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 mr-4">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-wider ${b.type === 'qa' ? 'bg-blue-100 text-blue-700' : b.type === 'paper' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {b.type === 'qa' ? 'Answer' : b.type === 'paper' ? 'Paper' : 'Project'}
                                                </span>
                                                <h3 className="font-bold text-base mt-2 dark:text-white leading-tight line-clamp-2">{b.title}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1">{new Date(b.timestamp).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => deleteBookmark(b.id)} className="text-gray-300 hover:text-red-500 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"><Trash className="w-4 h-4"/></button>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl max-h-32 overflow-hidden relative">
                                            {b.image && (
                                                <img src={b.image} alt="Cover" className="h-24 w-full object-cover rounded-lg mb-3 opacity-90 shadow-sm" />
                                            )}
                                            <p className="font-serif text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{b.content}</p>
                                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent"></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Inline Productivity Tools */}
                    {(libraryTab === 'todo' || libraryTab === 'diary') && (
                        <FloatingTools username={settings.username} activeTab={libraryTab} />
                    )}

                    {/* Settings Tab Content */}
                    {libraryTab === 'settings' && (
                        <div className="animate-fade-in pb-10">
                            <Settings settings={settings} updateSettings={updateSettings} onLogout={handleLogout} />
                        </div>
                    )}
                </div>
            </div>
        )}

      </main>

      {/* --- Bottom Navigation --- */}
      <nav className="shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-safe z-50 absolute bottom-0 w-full shadow-[0_-5px_30px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-20 pb-2">
            <MobileNavButton target="study" icon={BookOpen} label="Ask" />
            <MobileNavButton target="quiz" icon={HelpCircle} label="Quiz" />
            <MobileNavButton target="project" icon={PenTool} label="Project" />
            <MobileNavButton target="chat" icon={MessageCircle} label="Chat" />
            <MobileNavButton target="bookmarks" icon={BookmarkIcon} label="Library" />
        </div>
      </nav>

    </div>
  );
};

export default App;