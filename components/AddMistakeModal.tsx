
import React, { useState, useRef } from 'react';
import { Upload, X, ArrowRight, Image as ImageIcon, Check, Loader2 } from 'lucide-react';
import { Subject, MistakeItem, MasteryLevel, Language } from '../types';
import { t, getSubjectLabel } from '../utils/translations';

interface AddMistakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: MistakeItem) => Promise<void>;
  language: Language;
}

const AddMistakeModal: React.FC<AddMistakeModalProps> = ({ isOpen, onClose, onSave, language }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.SANSU);
  const [userNote, setUserNote] = useState('');
  const [userCorrectAnswer, setUserCorrectAnswer] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Validation
  const isValid = selectedImage && userCorrectAnswer.trim().length > 0 && !isCompressing && !isSaving;

  // Image Compression Helper
  const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          // Balanced Setting:
          // 1600px is high enough for clear text/diagrams.
          // 0.7 quality keeps file size safe for Firestore 1MB limit.
          const maxWidth = 1600; 
          const quality = 0.7;   
          const reader = new FileReader();
          
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;

                  if (width > maxWidth) {
                      height = Math.round((height * maxWidth) / width);
                      width = maxWidth;
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                      reject("Canvas context error");
                      return;
                  }
                  ctx.drawImage(img, 0, 0, width, height);
                  
                  // Convert to Base64 (JPEG)
                  const dataUrl = canvas.toDataURL('image/jpeg', quality);
                  resolve(dataUrl);
              };
              img.onerror = (err) => reject(err);
          };
          reader.onerror = (err) => reject(err);
      });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCompressing(true);
      try {
        const compressedDataUrl = await compressImage(file);
        setSelectedImage(compressedDataUrl);
      } catch (error) {
        console.error("Error compressing image", error);
        alert("Image processing failed.");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);

    try {
        const newItem: MistakeItem = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            imageUrl: selectedImage!, 
            questionText: userNote || "Image only",
            userNotes: userNote,
            userCorrectAnswer: userCorrectAnswer,
            reflection: "", 
            aiSolution: "",
            aiAnalysis: "",
            tags: [],
            subject: selectedSubject,
            mastery: MasteryLevel.NEW,
            reviewCount: 0
        };
        
        await onSave(newItem); 
        resetModal();
    } catch (e) {
        console.error(e);
        alert(t('save_error', language));
    } finally {
        setIsSaving(false);
    }
  };

  const resetModal = () => {
    setSelectedImage(null);
    setUserNote('');
    setUserCorrectAnswer('');
    setSelectedSubject(Subject.SANSU);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col transform transition-all max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
             {t('add_mistake', language)}
          </h3>
          <button onClick={resetModal} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          
          {!selectedImage ? (
            <div className="flex flex-col items-center justify-center h-[300px]">
                {isCompressing ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-indigo-500" size={40} />
                        <p className="text-slate-500 font-medium">{t('optimize_image', language)}</p>
                    </div>
                ) : (
                    <div 
                        className="group w-full h-full border-3 border-dashed border-indigo-200 rounded-3xl bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange}
                        />
                        
                        <div className="bg-white p-5 rounded-2xl shadow-lg shadow-indigo-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="text-indigo-600" size={40} />
                        </div>
                        <p className="text-slate-700 font-bold text-xl mb-2">{t('upload_photo', language)}</p>
                        <p className="text-slate-500 text-sm">{t('drag_drop', language)}</p>
                    </div>
                )}
            </div>
          ) : (
            <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white group">
                    <img src={selectedImage} alt="Preview" className="w-full h-64 object-contain bg-slate-50" />
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('subject', language)}</label>
                        <select 
                            value={selectedSubject} 
                            onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-bold"
                        >
                            {Object.values(Subject).map(s => (
                            <option key={s} value={s}>{getSubjectLabel(s, language)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                         <label className="block text-sm font-bold text-slate-700 mb-2">{t('memo_optional', language)}</label>
                         <input 
                            type="text"
                            placeholder={t('memo_placeholder', language)}
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                        />
                    </div>
                </div>

                {/* Correct Answer Field (Mandatory) */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700">{t('correct_answer_required', language)}</label>
                        <span className="text-xs text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-full">Required</span>
                    </div>
                    <textarea 
                        placeholder={t('correct_answer_placeholder', language)}
                        value={userCorrectAnswer}
                        onChange={(e) => setUserCorrectAnswer(e.target.value)}
                        className={`w-full p-3 bg-white border rounded-xl focus:ring-2 outline-none text-slate-700 h-24 resize-none transition-all ${
                            userCorrectAnswer.trim().length === 0 
                            ? 'border-rose-200 focus:ring-rose-500 focus:border-rose-500' 
                            : 'border-slate-200 focus:ring-indigo-500'
                        }`}
                    />
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end items-center gap-3 shrink-0">
            <button 
                onClick={resetModal}
                disabled={isSaving}
                className="px-6 py-3 text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
            >
                {t('cancel', language)}
            </button>
            <button 
                onClick={handleSave}
                disabled={!isValid || isSaving}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transform active:scale-95 transition-all"
            >
                {isSaving ? (
                    <><Loader2 size={18} className="animate-spin" /> {t('saving', language)}</>
                ) : (
                    <>{t('save', language)} <Check size={18} /></>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddMistakeModal;
