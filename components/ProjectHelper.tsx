import React, { useState } from 'react';
import { Subject, ProjectType, ClassLevel, Bookmark } from '../types';
import { SUBJECTS } from '../constants';
import { getProjectContent } from '../services/geminiService';
import { Loader2, FileText, ArrowRight, Printer, Bookmark as BookmarkIcon, Download, RefreshCcw } from 'lucide-react';

interface ProjectHelperProps {
  classLevel: ClassLevel;
  onBookmark: (b: Bookmark) => void;
}

const PROJECT_TYPES: ProjectType[] = ['ASL', 'Practical File', 'School Project / Assignment'];

const ProjectHelper: React.FC<ProjectHelperProps> = ({ classLevel, onBookmark }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [subject, setSubject] = useState<Subject | ''>('');
  const [type, setType] = useState<ProjectType | ''>('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  const nextStep = () => setStep(prev => (prev < 4 ? prev + 1 : prev) as any);
  
  const generate = async () => {
    if (!subject || !type) return;
    setLoading(true);
    setStep(4);
    const content = await getProjectContent(subject, type, topic || 'General', classLevel);
    setResult(content);
    setLoading(false);
  };

  const reset = () => {
    setStep(1);
    setSubject('');
    setType('');
    setTopic('');
    setResult('');
  };

  const handleExportDoc = () => {
      if (!result) return;
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${subject} Project</title></head><body>`;
      const footer = "</body></html>";
      
      const sourceHTML = header + 
          `<div style="font-family: 'Times New Roman', serif; white-space: pre-wrap;">
              <h1 style="text-align: center;">${subject} - ${type}</h1>
              ${result.replace(/\n/g, '<br/>')}
          </div>` + footer;
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${subject}_${type.replace(/\//g, '-')}_Project.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

  const handleSave = () => {
      if(result) {
          onBookmark({
              id: Date.now().toString(),
              type: 'project',
              title: `${subject}: ${topic || type}`,
              content: result,
              timestamp: Date.now()
          });
          alert('Saved!');
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
       {/* Header with Progress */}
       <div className="bg-white dark:bg-gray-900 p-6 shadow-sm border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                Project Wiz
            </h2>
            <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'}`}></div>
                ))}
            </div>
       </div>

       <div className="p-4 flex-1 overflow-y-auto custom-scrollbar pb-28">
           {step === 1 && (
             <div className="space-y-4 animate-fade-in">
               <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">Pick a Subject</h3>
               <div className="grid grid-cols-2 gap-3">
                 {SUBJECTS.map((s) => (
                   <button key={s} onClick={() => { setSubject(s); nextStep(); }} className="p-4 rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-sm shadow-sm active:scale-95 transition-transform border border-gray-100 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500">
                     {s}
                   </button>
                 ))}
               </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-6 animate-fade-in">
               <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">What kind of work?</h3>
               <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg text-indigo-800 dark:text-indigo-200 text-xs font-bold inline-block border border-indigo-100 dark:border-indigo-900/30">Subject: {subject}</div>
               <div className="space-y-3">
                 {PROJECT_TYPES.map((t) => (
                   <button key={t} onClick={() => { setType(t); nextStep(); }} className="w-full p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-left font-bold flex justify-between items-center shadow-sm hover:border-indigo-500 transition-colors group">
                     {t} <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                   </button>
                 ))}
               </div>
             </div>
           )}

           {step === 3 && (
             <div className="space-y-6 animate-fade-in">
               <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">What is the topic?</h3>
               <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                   <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">Project Topic</label>
                   <input 
                     type="text" 
                     value={topic}
                     onChange={(e) => setTopic(e.target.value)}
                     placeholder="e.g. Story of Cricket..."
                     className="w-full p-4 text-lg bg-gray-50 dark:bg-gray-700/50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-medium border-transparent transition-all placeholder-gray-400"
                   />
               </div>
               <button onClick={generate} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-transform hover:bg-indigo-700 flex justify-center items-center gap-2">
                 Generate Content <ArrowRight className="w-5 h-5"/>
               </button>
             </div>
           )}

           {step === 4 && (
             <div className="animate-fade-in space-y-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                    <p className="mt-6 font-bold text-gray-500">Crafting your project...</p>
                  </div>
                ) : (
                  <>
                     <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        <button onClick={handleSave} className="shrink-0 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none"><BookmarkIcon className="w-3 h-3"/> Save</button>
                        <button onClick={handleExportDoc} className="shrink-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-50"><Download className="w-3 h-3"/> Word</button>
                        <button onClick={reset} className="shrink-0 text-gray-400 px-4 py-2.5 text-xs font-bold hover:text-gray-600 flex items-center gap-1"><RefreshCcw className="w-3 h-3"/> New</button>
                     </div>

                     <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                        <pre className="whitespace-pre-wrap font-serif text-gray-800 dark:text-gray-300 text-sm leading-relaxed">{result}</pre>
                     </div>
                  </>
                )}
             </div>
           )}
       </div>
    </div>
  );
};

export default ProjectHelper;