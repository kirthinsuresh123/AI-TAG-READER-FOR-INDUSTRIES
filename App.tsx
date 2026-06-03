
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Search, Download, RefreshCw, AlertCircle, CheckCircle2, Factory, Camera, Zap, X, Filter, BarChart3, Box, Edit3, Maximize2, Scan, Smartphone, AlertTriangle, RotateCcw, ExternalLink, Loader2, FileSpreadsheet, Layers, ArrowRight, ChevronRight, Ruler, Gauge } from 'lucide-react';
import { MachinePart, ExtractionResult, ProcessingStatus } from './types';
import { extractTagData, generateComponentVisual } from './services/geminiService';

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-nike-red text-white font-black px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const CameraScanner: React.FC<{ onCapture: (base64: string) => void; onClose: () => void }> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported.");
      }
      const constraints = { 
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: false 
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err: any) {
      setCameraError(`Camera access error: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [startCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && !cameraError) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        onCapture(canvasRef.current.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-2xl aspect-video bg-zinc-900 overflow-hidden border-4 border-nike-red shadow-2xl flex items-center justify-center">
        {cameraError ? (
          <div className="p-8 text-center text-white">
            <AlertTriangle size={64} className="text-nike-red mx-auto mb-6" />
            <p className="text-zinc-400 mb-8">{cameraError}</p>
            <button onClick={onClose} className="bg-nike-red px-8 py-3 font-black uppercase tracking-widest text-xs">Close</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={onClose} className="absolute top-6 right-6 p-4 bg-black/50 text-white rounded-full"><X size={24} /></button>
          </>
        )}
      </div>
      {!cameraError && (
        <button onClick={handleCapture} className="mt-12 w-24 h-24 rounded-full border-8 border-white bg-nike-red flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"><Scan size={32} className="text-white" /></button>
      )}
    </div>
  );
};

const EditableCell: React.FC<{ value: string; onChange: (v: string) => void; className?: string; highlight?: string; type?: 'text' | 'textarea' }> = ({ value, onChange, className = "", highlight = "", type = "text" }) => {
  const [isFocused, setIsFocused] = useState(false);
  if (type === 'textarea') {
    return (
      <div className="relative w-full group">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full bg-transparent border-b-2 py-1 px-1 outline-none transition-all resize-none overflow-hidden min-h-[40px] ${isFocused ? "border-nike-red text-black font-bold" : "border-zinc-100 text-zinc-500 font-medium"} ${className}`}
          rows={1}
        />
        {!isFocused && highlight && <div className="absolute inset-0 pointer-events-none py-1 px-1 whitespace-pre-wrap break-words opacity-0 group-hover:opacity-100 bg-white/80 transition-opacity"><HighlightText text={value} highlight={highlight} /></div>}
      </div>
    );
  }
  return (
    <div className="relative w-full group">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full bg-transparent border-b-2 py-1 px-1 outline-none transition-all ${isFocused ? "border-nike-red text-black font-black italic" : "border-zinc-100 text-zinc-900"} ${className}`}
      />
      {!isFocused && highlight && <div className="absolute inset-0 pointer-events-none py-1 px-1 flex items-center opacity-0 group-hover:opacity-100 bg-white/80 transition-opacity"><HighlightText text={value} highlight={highlight} /></div>}
    </div>
  );
};

const App: React.FC = () => {
  const [inventory, setInventory] = useState<MachinePart[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [error, setError] = useState<{ message: string; type: 'quota' | 'general' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedPartForVisual, setSelectedPartForVisual] = useState<MachinePart | null>(null);
  const [visualizingIds, setVisualizingIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = async (base64: string) => {
    setStatus(ProcessingStatus.LOADING);
    setIsCameraOpen(false);
    setError(null);
    try {
      const result = await extractTagData(base64);
      const partId = updateInventory(result, base64);
      setLastScannedId(partId);
      setStatus(ProcessingStatus.SUCCESS);
      setTimeout(() => { setStatus(ProcessingStatus.IDLE); setLastScannedId(null); }, 5000);
    } catch (err: any) {
      setError({ type: 'general', message: "Unable to decode tag." });
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const exportToExcel = () => {
    if (inventory.length === 0) return;

    const headers = ['ID', 'Machine Name', 'Raw Materials', 'Tech Specs (PSI/Inches)', 'Units', 'Internal Components', 'Last Updated'];
    const rows = inventory.map(p => [
      p.id,
      `"${p.machineName.replace(/"/g, '""')}"`,
      `"${p.rawMaterials.replace(/"/g, '""')}"`,
      `"${p.technicalSpecs.replace(/"/g, '""')}"`,
      `"${p.units.replace(/"/g, '""')}"`,
      `"${(p.internalComponents || []).join(', ').replace(/"/g, '""')}"`,
      p.lastUpdated
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `INTAG_SPEC_LOG_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateVisual = async (part: MachinePart) => {
    if (visualizingIds.has(part.id)) return;
    setVisualizingIds(prev => new Set(prev).add(part.id));
    setError(null);
    try {
      const imageUrl = await generateComponentVisual({
        machineName: part.machineName,
        rawMaterials: part.rawMaterials,
        technicalSpecs: part.technicalSpecs,
        units: part.units,
        internalComponents: part.internalComponents
      }, part.tagImageUrl);
      
      setInventory(prev => prev.map(p => p.id === part.id ? { ...p, imageUrl } : p));
      setSelectedPartForVisual({ ...part, imageUrl });
    } catch (err: any) {
      setError({ type: 'general', message: "3D Render generation failed." });
    } finally {
      setVisualizingIds(prev => { const next = new Set(prev); next.delete(part.id); return next; });
    }
  };

  const updateInventory = useCallback((data: ExtractionResult, base64: string): string => {
    const now = new Date().toLocaleString('en-US', { hour12: false });
    let targetId = '';
    setInventory(prev => {
      const existingIndex = prev.findIndex(p => p.machineName.toLowerCase() === data.machineName.toLowerCase());
      if (existingIndex > -1) {
        const updated = [...prev];
        targetId = updated[existingIndex].id;
        updated[existingIndex] = { ...updated[existingIndex], ...data, tagImageUrl: base64, lastUpdated: now };
        return updated;
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        targetId = newId;
        return [{ id: newId, ...data, tagImageUrl: base64, lastUpdated: now, status: 'active' }, ...prev];
      }
    });
    return targetId;
  }, []);

  const handleManualEdit = (id: string, field: keyof MachinePart, newValue: string) => {
    setInventory(prev => prev.map(p => p.id === id ? { ...p, [field]: newValue, lastUpdated: new Date().toLocaleString() } : p));
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(part => {
      const s = searchTerm.toLowerCase();
      return part.machineName.toLowerCase().includes(s) || 
             part.rawMaterials.toLowerCase().includes(s) || 
             part.technicalSpecs.toLowerCase().includes(s) ||
             part.internalComponents.some(comp => comp.toLowerCase().includes(s));
    });
  }, [inventory, searchTerm]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 font-sans selection:bg-nike-red selection:text-white">
      <div className="h-2 bg-nike-red w-full"></div>
      <header className="bg-black text-white px-6 py-8 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-nike-red p-3 transform -skew-x-12"><Zap size={32} className="text-white fill-white" /></div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">InTag <span className="text-nike-red ml-1">Live</span></h1>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 mt-1">Technical Spec Ingestion</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToExcel}
              disabled={inventory.length === 0}
              className="bg-zinc-800 text-white px-8 py-5 font-black uppercase tracking-widest text-sm transition-all flex items-center gap-4 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={24} /> Export Specs
            </button>
            <button onClick={() => setIsCameraOpen(true)} className="bg-white text-black px-10 py-5 font-black uppercase tracking-widest text-sm transition-all flex items-center gap-4 hover:bg-zinc-200"><Smartphone size={24} /> Live Scan</button>
            <button onClick={() => fileInputRef.current?.click()} className="bg-nike-red text-white px-10 py-5 font-black uppercase tracking-widest text-sm transition-all flex items-center gap-4 hover:bg-red-700 shadow-xl">
              {status === ProcessingStatus.LOADING ? <RefreshCw className="animate-spin" size={24} /> : <Camera size={24} />}
              Analyze Tag
            </button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => processData(reader.result as string);
                reader.readAsDataURL(file);
              }
            }} />
          </div>
        </div>
      </header>

      {isCameraOpen && <CameraScanner onCapture={processData} onClose={() => setIsCameraOpen(false)} />}

      {selectedPartForVisual && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="max-w-7xl w-full bg-white grid grid-cols-1 lg:grid-cols-12 overflow-hidden border-8 border-black shadow-2xl h-[90vh]">
            {/* Left Content: Specs and Internals */}
            <div className="lg:col-span-4 p-12 space-y-10 overflow-y-auto border-r-4 border-zinc-100">
              <button onClick={() => setSelectedPartForVisual(null)} className="text-zinc-400 hover:text-nike-red transition-colors flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.3em]"><X size={20}/> Exit System View</button>
              
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-nike-red">Asset Technical Profile</p>
                <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none break-words">{selectedPartForVisual.machineName}</h2>
              </div>

              <div className="space-y-8 pt-8 border-t-2 border-zinc-50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-4 border-l-4 border-nike-red">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1 flex items-center gap-2"><Gauge size={12} /> Tech Spec</p>
                    <p className="font-black text-lg text-black leading-tight uppercase italic">{selectedPartForVisual.technicalSpecs || "N/A"}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 border-l-4 border-black">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1 flex items-center gap-2"><Ruler size={12} /> Capacity</p>
                    <p className="font-black text-lg text-black leading-tight uppercase italic">{selectedPartForVisual.units}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Base Materiality</p>
                  <p className="font-bold text-lg leading-snug">{selectedPartForVisual.rawMaterials}</p>
                </div>

                <div className="pt-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Internal System Architecture</p>
                  <div className="space-y-2">
                    {selectedPartForVisual.internalComponents.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-3 group">
                        <ChevronRight size={14} className="text-nike-red" />
                        <span className="text-xs font-black uppercase tracking-tight text-zinc-800 group-hover:translate-x-1 transition-transform">{comp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-12 bg-zinc-50 p-6 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Reference Image Context</p>
                <div className="aspect-video bg-zinc-200 overflow-hidden relative border-2 border-white shadow-lg">
                   <img src={selectedPartForVisual.tagImageUrl} alt="Source Tag" className="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-500" />
                </div>
              </div>
            </div>

            {/* Right Content: Systematic 3D View */}
            <div className="lg:col-span-8 bg-zinc-900 flex items-center justify-center p-12 relative group overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-black"></div>
              
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <img 
                  src={selectedPartForVisual.imageUrl} 
                  alt="3D Systematic Render" 
                  className="max-w-full max-h-full object-contain shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] border-4 border-zinc-700 animate-in zoom-in-95 duration-700" 
                />
              </div>

              <div className="absolute top-8 right-8 text-right space-y-2 pointer-events-none z-20">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-nike-red">Engineering Visualization</p>
                <p className="text-xl font-black italic uppercase tracking-tighter text-white">Systematic Assembly 4.0</p>
              </div>
              
              <div className="absolute bottom-8 left-8 space-y-1 pointer-events-none z-20 opacity-40">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 italic">Specs: {selectedPartForVisual.technicalSpecs}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 italic">Mapped Internal Sub-Assemblies: {selectedPartForVisual.internalComponents.length}</p>
              </div>

              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30 opacity-10">
                <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 animate-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[{ label: 'Identified Assets', value: inventory.length, icon: Box },
            { label: 'Systematic Renders', value: inventory.filter(i => i.imageUrl).length, icon: Layers },
            { label: 'Sync Status', value: 'Live', icon: RefreshCw },
            { label: 'Engine Accuracy', value: 'High', icon: BarChart3 }].map((s, i) => (
            <div key={i} className="bg-white p-8 border-b-8 border-black hover:border-nike-red transition-all group shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <s.icon size={24} className="text-zinc-200 group-hover:text-nike-red transition-colors" />
                <span className="text-3xl font-black italic tracking-tighter leading-none">{s.value}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="relative group max-w-4xl mx-auto w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-nike-red" size={24} />
          <input 
            type="text" 
            placeholder="SEARCH BY NAME, PSI, OR DIMENSIONS..." 
            className="w-full pl-16 pr-8 py-6 bg-white border-4 border-black focus:border-nike-red outline-none transition-all font-black text-xl placeholder:text-zinc-200 uppercase italic"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="border-8 border-black bg-white overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-black text-white text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-6 w-24">Render</th>
                <th className="px-6 py-6">Machine Identity</th>
                <th className="px-6 py-6">Technical Specs</th>
                <th className="px-6 py-6">Operational</th>
                <th className="px-6 py-6 text-right">Engineering</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-zinc-100">
              {filteredInventory.map(part => (
                <tr key={part.id} className="group hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-6">
                    {part.imageUrl ? (
                      <button onClick={() => setSelectedPartForVisual(part)} className="w-16 h-16 border-2 border-zinc-100 group-hover:border-nike-red transition-all p-1 overflow-hidden relative">
                        <img src={part.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" alt="Exploded View" />
                      </button>
                    ) : (
                      <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center border-2 border-dashed border-zinc-200">
                        {visualizingIds.has(part.id) ? <Loader2 size={20} className="animate-spin text-nike-red" /> : <Box size={20} className="text-zinc-200" />}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <EditableCell value={part.machineName} onChange={v => handleManualEdit(part.id, 'machineName', v)} className="text-xl font-black italic uppercase tracking-tighter" highlight={searchTerm} />
                    <p className="text-[9px] font-black uppercase text-zinc-400 mt-1 italic tracking-widest">Logged: {part.lastUpdated}</p>
                  </td>
                  <td className="px-6 py-6">
                    <EditableCell value={part.technicalSpecs} onChange={v => handleManualEdit(part.id, 'technicalSpecs', v)} className="text-sm font-black text-nike-red italic uppercase" highlight={searchTerm} />
                    <p className="text-[9px] font-black uppercase text-zinc-400 mt-1">PSI / Inches / Electrical</p>
                  </td>
                  <td className="px-6 py-6">
                    <EditableCell value={part.units} onChange={v => handleManualEdit(part.id, 'units', v)} className="text-xs font-bold text-zinc-700" highlight={searchTerm} />
                  </td>
                  <td className="px-6 py-6 text-right">
                    <button 
                      onClick={() => part.imageUrl ? setSelectedPartForVisual(part) : handleGenerateVisual(part)}
                      disabled={visualizingIds.has(part.id)}
                      className="bg-black text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-nike-red disabled:bg-zinc-100 disabled:text-zinc-400 transition-all flex items-center gap-2 ml-auto shadow-sm active:scale-95"
                    >
                      {visualizingIds.has(part.id) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Layers size={14} />
                      )}
                      <span>{part.imageUrl ? 'Review 3D' : 'Analyze 3D'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInventory.length === 0 && (
            <div className="p-24 text-center">
              <div className="inline-block p-6 rounded-full bg-zinc-50 mb-6">
                <Factory size={64} className="mx-auto text-zinc-200" />
              </div>
              <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-xs">Waiting for High-Detail Spec Analysis...</p>
            </div>
          )}
        </div>
      </main>
      
      {status === ProcessingStatus.SUCCESS && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-black text-white px-8 py-4 border-l-8 border-nike-red shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10">
          <CheckCircle2 className="text-nike-red" size={24} />
          <p className="font-black uppercase tracking-widest text-xs italic">Asset Specs (PSI/Units/Inches) Cataloged</p>
        </div>
      )}
    </div>
  );
};

export default App;
