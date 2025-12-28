import React, { useState } from 'react';
import { UserSettings, ClassLevel } from '../types';
import { GraduationCap, ArrowRight, Mail, User, AlertCircle, Lock, BookOpen } from 'lucide-react';
import { CLASSES } from '../constants';

interface LoginProps {
  onLogin: (name: string, email: string, username: string, classLevel: ClassLevel, password: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [classLevel, setClassLevel] = useState<ClassLevel>('10');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3) throw new Error("Username too short.");
      if (name.trim() && email.trim()) {
        await onLogin(name, email, cleanUsername, classLevel, password || 'default');
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
        {/* Modern Header */}
        <div className="bg-indigo-600 dark:bg-indigo-900 p-8 pb-16 rounded-b-[3rem] relative overflow-hidden shrink-0">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
             <div className="absolute top-10 -left-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-50"></div>

             <div className="relative z-10 flex flex-col items-center mt-6">
                <div className="bg-white/10 backdrop-blur-md w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-white/20">
                    <BookOpen className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">Study Buddy</h1>
                <p className="text-indigo-200 text-sm font-medium mt-2">Your AI Learning Companion</p>
             </div>
        </div>

        <div className="px-6 -mt-10 pb-8 flex-1 flex flex-col max-w-sm mx-auto w-full z-20">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-5 animate-fade-in-up">
            
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 p-3 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-300 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}
            
            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full p-4 pl-12 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 font-semibold text-sm transition-all placeholder-gray-400"
                />
              </div>
              
              <div className="relative group">
                <div className="absolute left-4 top-4 w-5 h-5 flex items-center justify-center font-black text-gray-400 group-focus-within:text-indigo-500 transition-colors">@</div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="Username"
                  className="w-full p-4 pl-12 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 font-semibold text-sm transition-all placeholder-gray-400"
                />
              </div>
              
              <div className="relative group">
                <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full p-4 pl-12 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 font-semibold text-sm transition-all placeholder-gray-400"
                />
              </div>

              <div className="relative group">
                 <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                 <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full p-4 pl-12 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 font-semibold text-sm transition-all placeholder-gray-400"
                  />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider ml-1">Select Class</p>
              <div className="flex justify-between gap-2">
                {CLASSES.map((cls) => (
                  <button
                    type="button"
                    key={cls}
                    onClick={() => setClassLevel(cls)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                      classLevel === cls
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-xl shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 text-base hover:opacity-90"
            >
              {loading ? "Creating Profile..." : <>Start Learning <ArrowRight className="w-5 h-5"/></>}
            </button>
          </form>
          
          <p className="text-center text-xs text-gray-400 mt-6 font-medium">
             By joining, you agree to become a Study Buddy.
          </p>
        </div>
    </div>
  );
};

export default Login;