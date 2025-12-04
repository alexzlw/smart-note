import React, { useState, useRef, useEffect } from 'react';
import { MistakeItem, MasteryLevel } from '../types';
import { Eye, EyeOff, BrainCircuit, RefreshCw, ChevronDown, Check, Sparkles, Loader2, BookCheck, Trash2, AlertTriangle, PenLine, Keyboard, PenTool, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateSimilarQuestion, analyzeImage } from '../services/geminiService';
import HandwritingCanvas from './HandwritingCanvas';

interface ReviewCardProps {
  item: MistakeItem;
  onUpdateMastery: (id: string, level: MasteryLevel) => void;
  onUpdateItem: (item: MistakeItem) => void;
  onDelete?: (id: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ item, onUpdateMastery, onUpdateItem, onDelete }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [similarQuestion, setSimilarQuestion] = useState<{q: string, a: string, svg?: string} | null>(null);
  const [generatingSimilar, setGeneratingSimilar] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Reflection state
  const [reflection, setReflection] = useState(item.reflection || '');
  const [reflectionImage, setReflectionImage] = useState<string | undefined>(item.reflectionImage);
  const [reflectionMode, setReflectionMode] = useState<'text' | 'draw'>('text');
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);

  // Swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isSwiped, setIsSwiped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // Don't trigger swipe if interacting with inner elements like canvas or buttons
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('canvas') || (e.target as HTMLElement).closest('textarea')) {
        return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
        setIsSwiped(true);
    } 
    if (isRightSwipe) {
        setIsSwiped(false);
    }
  };

  // Check if AI analysis has been done
  const hasAnalysis = item.aiSolution && item.aiSolution.length > 0;
  // Check if user provided manual answer
  const hasUserAnswer = item.userCorrectAnswer && item.userCorrectAnswer.trim().length > 0;

  // Show "Check Answer" functionality if we have EITHER AI analysis OR a user manual answer
  const canShowAnswer = hasAnalysis || hasUserAnswer;

  const handleAnalyze = async () => {
    if (!item.imageUrl) return;
    setAnalyzing(true);
    setErrorMsg(null);
    try {
        const result = await analyzeImage(item.imageUrl, item.userNotes || "");
        
        const updatedItem: MistakeItem = {
            ...item,
            questionText: result.questionText,
            aiSolution: result.solution,
            aiAnalysis: result.analysis,
            aiDiagram: result.svgDiagram,
            tags: result.tags,
        };
        onUpdateItem(updatedItem);
        setShowAnswer(true); // Auto open
    } catch (e: any) {
        console.error(e);
        const msg = e.message || e.toString();
        if (msg.includes("quota") || msg.includes("429")) {
            setErrorMsg("⚠️ 利用制限(Quota)に達しました。しばらく時間を置いてから再度お試しください。");
        } else {
            setErrorMsg("⚠️ 分析に失敗しました。もう一度お試しください。");
        }
    } finally {
        setAnalyzing(false);
    }
  };

  const handleGenerateSimilar = async () => {
    setGeneratingSimilar(true);
    try {
        const res = await generateSimilarQuestion(item.questionText, item.aiAnalysis || "");
        setSimilarQuestion({ q: res.question, a: res.answer, svg: res.svgDiagram });
    } catch (e) {
        alert("類似問題の作成に失敗しました。");
    } finally {
        setGeneratingSimilar(false);
    }
  };

  const handleDelete = () => {
      if(onDelete) {
          onDelete(item.id);
          setIsSwiped(false); // Reset in case delete is cancelled
      }
  }
  
  const handleReflectionBlur = () => {
      if (reflection !== item.reflection) {
          onUpdateItem({ ...item, reflection });
      }
  }

  const handleSaveDrawing = (imageData: string) => {
      setReflectionImage(imageData);
      setIsDrawingOpen(false);
      onUpdateItem({ ...item, reflectionImage: imageData });
  }

  const masteryConfig = {
      [MasteryLevel.NEW]: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: MasteryLevel.NEW },
      [MasteryLevel.REVIEWING]: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: MasteryLevel.REVIEWING },
      [MasteryLevel.MASTERED]: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: MasteryLevel.MASTERED }
  };

  const SvgRenderer = ({ svg }: { svg?: string }) => {
    if (!svg || !svg.includes('<svg')) return null;
    // Basic cleanup of markdown block code if any remains
    const cleanSvg = svg.replace(/```xml|```svg|```/g, '').trim();
    return (
        <div 
            className="my-4 p-4 bg-white rounded-lg border border-slate-200 flex justify-center"
            dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
    );
  };

  return (
    <div 
        ref={cardRef}
        className="relative mb-6 select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      {/* Background Delete Button (visible on swipe) */}
      <div className={`absolute inset-y-0 right-0 w-24 bg-red-500 rounded-3xl flex items-center justify-center z-0 transition-opacity duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={handleDelete} className="text-white flex flex-col items-center">
              <Trash2 size={24} />
              <span className="text-xs font-bold mt-1">削除</span>
          </button>
      </div>

      {/* Main Card Content */}
      <div 
        className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 transition-transform duration-300 relative z-10 ${isSwiped ? '-translate-x-24' : 'translate-x-0'}`}
        onClick={() => setIsSwiped(false)} // Reset swipe on click
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${masteryConfig[item.mastery].color}`}>
              {item.subject}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
               {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          <div className="relative group">
            <button className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${masteryConfig[item.mastery].color}`}>
              {masteryConfig[item.mastery].label} <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 p-1 hidden group-hover:block z-20">
              {Object.values(MasteryLevel).map(level => (
                <button
                  key={level}
                  onClick={() => onUpdateMastery(item.id, level)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors ${item.mastery === level ? 'text-indigo-600' : 'text-slate-600'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question Image */}
        {item.imageUrl && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
            <img src={item.imageUrl} alt="Question" className="w-full object-contain max-h-80" />
          </div>
        )}

        {/* User Notes */}
        {item.userNotes && (
          <div className="mb-4 text-slate-600 text-sm italic bg-slate-50 p-3 rounded-xl border border-slate-100 inline-block">
            📝 {item.userNotes}
          </div>
        )}
        
        {/* Reflection / Self-Correction Section */}
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <BrainCircuit size={16} className="text-indigo-500"/> 振り返り・反省メモ
                 </h4>
                 <div className="flex bg-slate-100 p-0.5 rounded-lg">
                     <button 
                        onClick={() => {
                            setReflectionMode('text');
                            setIsDrawingOpen(false);
                        }}
                        className={`p-1.5 rounded-md transition-all ${reflectionMode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        title="テキスト入力"
                     >
                         <Keyboard size={16} />
                     </button>
                     <button 
                         onClick={() => {
                             setReflectionMode('draw');
                             setIsDrawingOpen(true);
                         }}
                         className={`p-1.5 rounded-md transition-all ${reflectionMode === 'draw' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                         title="手書き入力"
                     >
                         <PenTool size={16} />
                     </button>
                 </div>
            </div>

            {/* Handwriting View/Edit Mode */}
            {reflectionMode === 'draw' && isDrawingOpen ? (
                <HandwritingCanvas 
                    initialImage={reflectionImage} 
                    onSave={handleSaveDrawing} 
                    onCancel={() => setIsDrawingOpen(false)}
                />
            ) : reflectionMode === 'draw' && !isDrawingOpen && reflectionImage ? (
                <div 
                    className="relative group border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => setIsDrawingOpen(true)}
                >
                    <img src={reflectionImage} alt="Reflection" className="w-full h-auto bg-white" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-sm">
                            タップして編集
                        </span>
                    </div>
                </div>
            ) : reflectionMode === 'draw' && !isDrawingOpen && !reflectionImage ? (
                 <button 
                    onClick={() => setIsDrawingOpen(true)}
                    className="w-full h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-indigo-300 transition-all gap-2"
                >
                    <Pencil size={20} />
                    <span className="text-sm font-medium">手書きメモを追加する</span>
                </button>
            ) : (
                /* Text Mode */
                <textarea 
                    className="w-full p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none"
                    rows={3}
                    placeholder="なぜ間違えた？次はどうする？（例：計算ミス。途中式を丁寧に書く）"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    onBlur={handleReflectionBlur}
                />
            )}
        </div>

        {/* Answer Section */}
        <div className={`overflow-hidden transition-all duration-500 ${showAnswer ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="pt-6 border-t border-slate-100 space-y-6">
            
            {/* User Manual Answer */}
            {item.userCorrectAnswer && (
                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
                        <Check size={18} /> 正解 (あなたのメモ)
                    </h4>
                    <p className="text-emerald-900 whitespace-pre-wrap font-medium">{item.userCorrectAnswer}</p>
                </div>
            )}

            {/* AI Solution */}
            {item.aiSolution && (
                <div className="bg-white">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-500" /> AI 解説
                    </h4>
                    
                    {/* SVG Diagram if available */}
                    <SvgRenderer svg={item.aiDiagram} />

                    <div className="prose prose-slate prose-sm max-w-none bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <ReactMarkdown>{item.aiSolution}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* AI Analysis */}
            {item.aiAnalysis && (
                <div className="bg-white">
                     <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <BrainCircuit size={18} className="text-indigo-500" /> 分析・ポイント
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        {item.aiAnalysis}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {item.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">#{tag}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Similar Question */}
            {similarQuestion ? (
                 <div className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100">
                    <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                        <BookCheck size={18} /> 類題で確認！
                    </h4>
                    
                    {/* SVG for similar question */}
                    <SvgRenderer svg={similarQuestion.svg} />

                    <div className="mb-4 font-medium text-slate-800">
                        Q. {similarQuestion.q}
                    </div>
                    <div className="text-sm bg-white/60 p-3 rounded-lg border border-indigo-100/50">
                        <span className="font-bold text-indigo-700 block mb-1">正解・解説:</span>
                        {similarQuestion.a}
                    </div>
                    <button 
                        onClick={() => setSimilarQuestion(null)}
                        className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                        閉じる
                    </button>
                 </div>
            ) : item.aiAnalysis && (
                 <button 
                    onClick={handleGenerateSimilar}
                    disabled={generatingSimilar}
                    className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 group"
                 >
                    {generatingSimilar ? (
                        <>
                            <Loader2 size={16} className="animate-spin" /> 作成中...
                        </>
                    ) : (
                        <>
                            <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" /> 
                            類題にチャレンジする
                        </>
                    )}
                 </button>
            )}
          </div>
        </div>

        {/* Action Bar (Footer) */}
        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between gap-3">
             {/* Show Answer Button */}
             <button 
                onClick={() => setShowAnswer(!showAnswer)}
                disabled={!canShowAnswer}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    canShowAnswer 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-slate-800 hover:scale-[1.02] active:scale-95' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
            >
                {showAnswer ? (
                    <><EyeOff size={18} /> 隠す</>
                ) : (
                    <><Eye size={18} /> 答えを見る</>
                )}
            </button>
            
            {/* Ask AI Button */}
            <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-wait"
            >
                 {analyzing ? (
                    <><Loader2 size={18} className="animate-spin" /> 解析中...</>
                 ) : (
                    <><Sparkles size={18} /> AI解説を作成</>
                 )}
            </button>
        </div>
        
        {/* Error Message Display */}
        {errorMsg && (
            <div className="mt-3 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-2 animate-fade-in">
                <AlertTriangle size={14} />
                {errorMsg}
            </div>
        )}

      </div>
    </div>
  );
};

export default ReviewCard;