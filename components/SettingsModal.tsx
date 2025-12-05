
import React, { useRef, useState } from 'react';
import { X, Download, Upload, Database, AlertCircle, Check, Trash2, Globe } from 'lucide-react';
import { MistakeItem, Language } from '../types';
import { dbService } from '../services/db';
import { t } from '../utils/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mistakes: MistakeItem[];
  onDataChanged: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, mistakes, onDataChanged, language, setLanguage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const dataStr = JSON.stringify(mistakes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-error-notebook-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json) as MistakeItem[];
        
        if (!Array.isArray(data)) throw new Error("Invalid file format");

        await dbService.importData(data);
        setImportStatus('success');
        onDataChanged(); // Refresh app state
        
        setTimeout(() => setImportStatus('idle'), 3000);
      } catch (error) {
        console.error("Import failed", error);
        setImportStatus('error');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
      if (confirm(t('delete_all_confirm', language))) {
          await dbService.clearAll();
          onDataChanged();
          setIsClearing(true);
          setTimeout(() => setIsClearing(false), 2000);
      }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Database size={20} />
            </div>
            {t('settings', language)}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
            
            {/* Language Settings (Priority) */}
            <div className="space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Globe size={18} className="text-blue-500"/> {t('language_settings', language)}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => setLanguage('ja')}
                        className={`py-2 px-3 rounded-xl border font-medium text-sm transition-all ${language === 'ja' ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        日本語
                    </button>
                    <button 
                         onClick={() => setLanguage('en')}
                         className={`py-2 px-3 rounded-xl border font-medium text-sm transition-all ${language === 'en' ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        English
                    </button>
                    <button 
                         onClick={() => setLanguage('zh')}
                         className={`py-2 px-3 rounded-xl border font-medium text-sm transition-all ${language === 'zh' ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        中文
                    </button>
                </div>
            </div>

            <div className="h-px bg-slate-100"></div>

            {/* Export Section */}
            <div className="space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Download size={18} className="text-indigo-600"/> {t('export_backup', language)}
                </h4>
                <p className="text-sm text-slate-500">
                    {t('export_desc', language)}
                </p>
                <button 
                    onClick={handleExport}
                    className="w-full py-3 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <Download size={18} /> {t('download_json', language)}
                </button>
            </div>

            {/* Import Section */}
            <div className="space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Upload size={18} className="text-emerald-600"/> {t('import_restore', language)}
                </h4>
                <p className="text-sm text-slate-500">
                    {t('import_desc', language)}
                </p>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".json"
                />
                
                <button 
                    onClick={handleImportClick}
                    className="w-full py-3 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-800 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <Upload size={18} /> {t('select_file', language)}
                </button>

                {importStatus === 'success' && (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
                        <Check size={16} /> {t('import_success', language)}
                    </div>
                )}
                {importStatus === 'error' && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
                        <AlertCircle size={16} /> {t('import_error', language)}
                    </div>
                )}
            </div>

             <div className="h-px bg-slate-100"></div>

            {/* Danger Zone */}
             <div className="space-y-3">
                <h4 className="font-bold text-red-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                    {t('danger_zone', language)}
                </h4>
                <button 
                    onClick={handleClearData}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline flex items-center gap-1"
                >
                    <Trash2 size={12} /> {t('delete_all_data', language)}
                </button>
                {isClearing && <span className="text-xs text-slate-400 ml-2">{t('deleted', language)}</span>}
            </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
