import React from 'react';
import { CREATOR_CREDIT, CLASSES } from '../constants';
import { UserSettings, ClassLevel } from '../types';
import { Moon, Sun, User, Save, LogOut, Mail, Award, BookOpen, Heart } from 'lucide-react';

interface SettingsProps {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  onLogout?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, updateSettings, onLogout }) => {
  const [localName, setLocalName] = React.useState(settings.name);

  const handleSave = () => {
    updateSettings({ name: localName });
  };

  return (
    <div className="space-y-6">
      
      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-bl-[4rem] opacity-10"></div>
          
          <div className="flex flex-col items-center mb-8 relative z-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200 dark:shadow-none mb-4">
                  {settings.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{settings.name}</h3>
              <p className="text-sm font-medium text-gray-400">@{settings.username}</p>
          </div>

          <div className="space-y-6">
             <div>
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Display Name</label>
                 <div className="flex gap-2">
                     <input 
                        value={localName} 
                        onChange={e => setLocalName(e.target.value)}
                        className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all dark:text-white" 
                     />
                     <button onClick={handleSave} className="bg-indigo-600 text-white px-5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"><Save className="w-4 h-4"/></button>
                 </div>
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Class Level</label>
                 <div className="grid grid-cols-4 gap-2">
                     {CLASSES.map(cls => (
                         <button 
                            key={cls}
                            onClick={() => updateSettings({classLevel: cls})}
                            className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${settings.classLevel === cls ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-transparent bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                         >
                             {cls}
                         </button>
                     ))}
                 </div>
             </div>
          </div>
      </div>

      {/* Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${settings.darkMode ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                      {settings.darkMode ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}
                  </div>
                  <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">Dark Mode</h4>
                      <p className="text-xs text-gray-500 font-medium">Adjust appearance</p>
                  </div>
              </div>
              <button 
                onClick={() => updateSettings({darkMode: !settings.darkMode})}
                className={`w-14 h-8 rounded-full transition-colors relative ${settings.darkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform duration-300 ${settings.darkMode ? 'left-7' : 'left-1'}`}></div>
              </button>
          </div>
          
          <div className="p-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl"><Mail className="w-5 h-5"/></div>
              <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">Linked Email</h4>
                  <p className="text-xs text-gray-500 font-medium">{settings.email}</p>
              </div>
          </div>
      </div>

      {/* Logout */}
      {onLogout && (
          <button onClick={onLogout} className="w-full bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
              <LogOut className="w-5 h-5" /> Log Out
          </button>
      )}

      {/* Credits */}
      <div className="pt-6 text-center pb-8 opacity-60">
           <div className="flex flex-col items-center justify-center gap-3">
               <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Created By</span>
               <div className="bg-white dark:bg-gray-800 px-5 py-2 rounded-full border border-gray-100 dark:border-gray-700 flex items-center gap-2 shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                   <p className="text-xs font-black text-gray-800 dark:text-gray-200 tracking-wide uppercase">{CREATOR_CREDIT}</p>
               </div>
           </div>
      </div>

    </div>
  );
};

export default Settings;