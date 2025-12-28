import React, { useState, useEffect } from 'react';
import { Plus, Trash, Calendar, CheckSquare, Edit3 } from 'lucide-react';
import { ToDoItem, DiaryEntry } from '../types';

interface FloatingToolsProps {
  username: string;
  activeTab: 'todo' | 'diary';
}

const FloatingTools: React.FC<FloatingToolsProps> = ({ username, activeTab }) => {
  // --- To Do Logic ---
  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');

  // --- Diary Logic ---
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [diaryContent, setDiaryContent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Keys tailored to username
  const TODO_KEY = `study_buddy_todos_${username}`;
  const DIARY_KEY = `study_buddy_diary_${username}`;

  // Load Data
  useEffect(() => {
    if (!username) return;
    const savedTodos = localStorage.getItem(TODO_KEY);
    if (savedTodos) setTodos(JSON.parse(savedTodos));
    
    const savedDiary = localStorage.getItem(DIARY_KEY);
    if (savedDiary) setEntries(JSON.parse(savedDiary));
  }, [username]);

  // Save Data
  useEffect(() => {
     if (username) localStorage.setItem(TODO_KEY, JSON.stringify(todos));
  }, [todos, username]);

  useEffect(() => {
     if (username) localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
  }, [entries, username]);

  // ToDo Handlers
  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now().toString(), text: newTodo, completed: false }]);
    setNewTodo('');
  };
  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };
  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  // Diary Handlers
  const saveDiary = () => {
      const existingIndex = entries.findIndex(e => e.date === selectedDate);
      if (existingIndex > -1) {
          const newEntries = [...entries];
          newEntries[existingIndex].content = diaryContent;
          setEntries(newEntries);
      } else if (diaryContent.trim()) {
          setEntries([...entries, { id: Date.now().toString(), date: selectedDate, content: diaryContent, timestamp: Date.now() }]);
      }
      alert("Entry saved.");
  };

  const loadDiaryEntry = (date: string) => {
      setSelectedDate(date);
      const entry = entries.find(e => e.date === date);
      setDiaryContent(entry ? entry.content : '');
  };

  if (!username) return null;

  // --- RENDER INLINE CONTENT ---

  if (activeTab === 'todo') {
      return (
          <div className="flex flex-col h-full animate-fade-in">
             <div className="flex gap-2 mb-6">
                 <input 
                    className="flex-1 border-none bg-white dark:bg-gray-800 p-4 rounded-2xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm shadow-sm"
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    placeholder="Add a new task..."
                    onKeyDown={e => e.key === 'Enter' && addTodo()}
                 />
                 <button 
                    onClick={addTodo} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-colors"
                 >
                   <Plus className="w-6 h-6"/>
                 </button>
             </div>
             <ul className="space-y-3">
                 {todos.length === 0 && (
                   <div className="text-center py-12 text-gray-400 flex flex-col items-center opacity-60">
                     <CheckSquare className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600"/>
                     <p className="font-bold">All caught up!</p>
                   </div>
                 )}
                 {todos.map(t => (
                     <li key={t.id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-100 dark:hover:border-gray-600 transition-all group">
                         <div className="relative flex items-center">
                           <input 
                             type="checkbox" 
                             checked={t.completed} 
                             onChange={() => toggleTodo(t.id)} 
                             className="w-6 h-6 cursor-pointer rounded-lg border-2 border-gray-300 checked:bg-indigo-600 checked:border-indigo-600 transition-colors"
                           />
                         </div>
                         <span className={`flex-1 text-sm font-bold ${t.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                           {t.text}
                         </span>
                         <button 
                           onClick={() => deleteTodo(t.id)} 
                           className="text-gray-300 hover:text-red-500 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                         >
                           <Trash className="w-4 h-4"/>
                         </button>
                     </li>
                 ))}
             </ul>
          </div>
      );
  }

  if (activeTab === 'diary') {
      return (
          <div className="flex flex-col h-full gap-4 animate-fade-in">
             <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                       <Calendar className="w-5 h-5"/>
                   </div>
                   <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Entry Date</span>
                 </div>
                 <input 
                    type="date" 
                    value={selectedDate}
                    onChange={e => loadDiaryEntry(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-gray-900 dark:text-white focus:ring-0 outline-none"
                 />
             </div>
             
             <div className="relative flex-1">
               <textarea 
                   className="w-full h-[400px] border-none bg-white dark:bg-gray-800 rounded-[2rem] p-8 text-base leading-relaxed text-gray-800 dark:text-white outline-none resize-none transition-all font-medium placeholder-gray-300 shadow-sm"
                   placeholder="Dear Diary, today I learned..."
                   value={diaryContent}
                   onChange={e => setDiaryContent(e.target.value)}
               />
               <div className="absolute bottom-6 right-8 text-xs font-bold text-gray-300 pointer-events-none">
                 {diaryContent.length} chars
               </div>
             </div>
             
             <button 
               onClick={saveDiary} 
               className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-transform active:scale-95 flex items-center justify-center gap-2"
             >
               <Edit3 className="w-5 h-5"/> Save Entry
             </button>
          </div>
      );
  }

  return null;
};

export default FloatingTools;