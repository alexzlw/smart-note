import React, { useRef, useEffect, useState } from 'react';
import { Save, X, Eraser, Pen, RotateCcw } from 'lucide-react';

interface HandwritingCanvasProps {
  initialImage?: string;
  onSave: (imageData: string) => void;
  onCancel: () => void;
}

const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({ initialImage, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');
  const [hasContent, setHasContent] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual size in memory (scaled to account for extra pixel density)
    // Using a fixed height for consistency
    const height = 300;
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;

    // Set display size via CSS
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1e293b'; // Slate-800
    context.lineWidth = 3;

    setCtx(context);

    // Load initial image if exists
    if (initialImage) {
        const img = new Image();
        img.onload = () => {
            context.drawImage(img, 0, 0, rect.width, height);
            setHasContent(true);
        };
        img.src = initialImage;
    }
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      return {
          x: clientX - rect.left,
          y: clientY - rect.top
      };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    // Note: e.preventDefault() is handled by CSS touch-action: none
    setIsDrawing(true);
    setHasContent(true);
    const { x, y } = getPos(e);
    if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || !ctx) return;
    const { x, y } = getPos(e);
    
    if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (ctx) ctx.closePath();
  };

  const handleSave = () => {
      if (!canvasRef.current) return;
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSave(dataUrl);
  };

  const handleClear = () => {
      if (!ctx || !canvasRef.current) return;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasContent(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-3 animate-fade-in bg-slate-50 p-2 rounded-xl border border-slate-200">
        <div className="relative w-full h-[300px] bg-white rounded-lg border border-slate-200 shadow-inner overflow-hidden">
            <canvas 
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>
        
        <div className="flex justify-between items-center px-1">
            <div className="flex gap-2">
                 <button 
                    onClick={() => setMode('pen')}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium ${mode === 'pen' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                 >
                    <Pen size={18} /> ペン
                 </button>
                 <button 
                    onClick={() => setMode('eraser')}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium ${mode === 'eraser' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                 >
                    <Eraser size={18} /> 消しゴム
                 </button>
                 <button 
                    onClick={handleClear}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title="すべて消去"
                 >
                    <RotateCcw size={18} />
                 </button>
            </div>
            <div className="flex gap-2">
                <button onClick={onCancel} className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">キャンセル</button>
                <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm">
                    <Save size={16} /> 保存
                </button>
            </div>
        </div>
    </div>
  );
};

export default HandwritingCanvas;