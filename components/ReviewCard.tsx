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
    const cleanSvg = svg.replace(/```xml|```svg|