import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
  Upload, 
  Settings2, 
  Play, 
  Download, 
  RefreshCw, 
  AlertCircle,
  Film,
  Info,
  Mic,
  MessageSquare,
  FileAudio,
  Type,
  Copy,
  Clock,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CompressionStatus = 'idle' | 'loading' | 'compressing' | 'completed' | 'error';
type TranscriptionStatus = 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
type AppTab = 'compressor' | 'transcribe';

type CompressionHistory = {
  id: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compression: number;
  timestamp: number;
  downloadUrl: string;
};

type TranscriptionHistory = {
  id: string;
  fileName: string;
  transcription: string;
  timestamp: number;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('compressor');
  
  // Video Compressor State
  const [loaded, setLoaded] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [status, setStatus] = useState<CompressionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState('original');
  const [preset, setPreset] = useState<'ultrafast' | 'superfast' | 'veryfast' | 'fast'>('ultrafast');

  // Transcriber State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>('idle');
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // History State
  const [compressionHistory, setCompressionHistory] = useState<CompressionHistory[]>([]);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const transcriptionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadFFmpeg();
    loadHistory();
  }, []);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on('log', ({ message }) => {
      console.log(message);
    });

    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });

    try {
      setLoaded(false);
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load ffmpeg', err);
      if (activeTab === 'compressor') {
        setErrorMessage('Failed to load FFmpeg. Check your internet connection.');
      }
    }
  };

  const loadHistory = () => {
    try {
      const savedCompressionHistory = localStorage.getItem('compressionHistory');
      const savedTranscriptionHistory = localStorage.getItem('transcriptionHistory');
      
      if (savedCompressionHistory) {
        setCompressionHistory(JSON.parse(savedCompressionHistory));
      }
      if (savedTranscriptionHistory) {
        setTranscriptionHistory(JSON.parse(savedTranscriptionHistory));
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const saveCompressionToHistory = (fileName: string, originalSize: number, compressedSize: number, downloadUrl: string) => {
    const newEntry: CompressionHistory = {
      id: Date.now().toString(),
      fileName,
      originalSize,
      compressedSize,
      compression: Math.round(((originalSize - compressedSize) / originalSize) * 100),
      timestamp: Date.now(),
      downloadUrl,
    };
    
    const updated = [newEntry, ...compressionHistory].slice(0, 20); // Keep last 20
    setCompressionHistory(updated);
    localStorage.setItem('compressionHistory', JSON.stringify(updated));
  };

  const saveTranscriptionToHistory = (fileName: string, transcription: string) => {
    const newEntry: TranscriptionHistory = {
      id: Date.now().toString(),
      fileName,
      transcription,
      timestamp: Date.now(),
    };
    
    const updated = [newEntry, ...transcriptionHistory].slice(0, 20); // Keep last 20
    setTranscriptionHistory(updated);
    localStorage.setItem('transcriptionHistory', JSON.stringify(updated));
  };

  const deleteCompressionHistory = (id: string) => {
    const updated = compressionHistory.filter(item => item.id !== id);
    setCompressionHistory(updated);
    localStorage.setItem('compressionHistory', JSON.stringify(updated));
  };

  const deleteTranscriptionHistory = (id: string) => {
    const updated = transcriptionHistory.filter(item => item.id !== id);
    setTranscriptionHistory(updated);
    localStorage.setItem('transcriptionHistory', JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    setCompressionHistory([]);
    setTranscriptionHistory([]);
    localStorage.removeItem('compressionHistory');
    localStorage.removeItem('transcriptionHistory');
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideo(file);
      setOutputUrl(null);
      setCompressedSize(null);
      setProgress(0);
      setStatus('idle');
    }
  };

  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      setTranscriptionResult(null);
      setTranscriptionStatus('idle');
      setTranscribeError(null);
    }
  };

  const compressVideo = async () => {
    if (!video || !loaded) return;
    setStatus('compressing');
    setProgress(0);
    const ffmpeg = ffmpegRef.current;
    const inputFileName = 'input_video';
    const outputFileName = 'output_video.mp4';

    try {
      await ffmpeg.writeFile(inputFileName, await fetchFile(video));
      
      const ffmpegArgs = [
        '-i', inputFileName,
        '-vcodec', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-acodec', 'aac',
      ];
      if (scale === '720p') ffmpegArgs.push('-vf', 'scale=-2:720');
      else if (scale === '480p') ffmpegArgs.push('-vf', 'scale=-2:480');
      ffmpegArgs.push(outputFileName);
      
      await ffmpeg.exec(ffmpegArgs);
      
      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setCompressedSize(blob.size);
      setStatus('completed');
      
      // Save to history
      saveCompressionToHistory(video.name, video.size, blob.size, url);
    } catch (err) {
      console.error('Compression error:', err);
      setStatus('error');
      setErrorMessage('An error occurred during compression.');
    }
  };

  const transcribeAudio = async () => {
    if (!audioFile) return;
    setTranscriptionStatus('transcribing');
    setTranscribeError(null);

    // Create abort controller for this transcription
    transcriptionAbortRef.current = new AbortController();

    const formData = new FormData();
    formData.append('audio', audioFile);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: transcriptionAbortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe');
      }

      const data = await response.json();
      setTranscriptionResult(data.transcription);
      setTranscriptionStatus('completed');
      
      // Save to history
      if (audioFile) {
        saveTranscriptionToHistory(audioFile.name, data.transcription);
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      if (err.name === 'AbortError') {
        setTranscriptionStatus('idle');
        setTranscribeError('Transcription cancelled by user.');
      } else {
        setTranscriptionStatus('error');
        setTranscribeError(err.message || 'Error communicating with Gemini AI.');
      }
    } finally {
      transcriptionAbortRef.current = null;
    }
  };

  const cancelTranscription = () => {
    if (transcriptionAbortRef.current) {
      transcriptionAbortRef.current.abort();
      setTranscriptionStatus('idle');
      setTranscribeError('Transcription cancelled by user.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyTranscription = () => {
    if (transcriptionResult) {
      navigator.clipboard.writeText(transcriptionResult);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Modern Navigation Bar */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Ali Mesjid</h1>
                <p className="text-xs text-slate-500 font-medium">Studio Tool</p>
              </div>
            </div>

            {/* Center Navigation */}
            <div className="hidden md:flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-xl">
              <button 
                onClick={() => setActiveTab('compressor')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  activeTab === 'compressor' 
                    ? 'bg-white text-blue-600 shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Film className="w-4 h-4" />
                Compressor
              </button>
              <button 
                onClick={() => setActiveTab('transcribe')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  activeTab === 'transcribe' 
                    ? 'bg-white text-blue-600 shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mic className="w-4 h-4" />
                Transcriber
              </button>
            </div>

            {/* Right Actions */}
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`px-4 py-2.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 text-sm ${
                showHistory
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="View history"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex gap-2 mt-4">
            <button 
              onClick={() => setActiveTab('compressor')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'compressor' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Film className="w-4 h-4 inline mr-2" />
              Compress
            </button>
            <button 
              onClick={() => setActiveTab('transcribe')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'transcribe' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Mic className="w-4 h-4 inline mr-2" />
              Transcribe
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

        {/* History Modal */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">History</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {compressionHistory.length === 0 && transcriptionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">No history yet</p>
                  <p className="text-slate-400 text-sm mt-2">Start compressing videos or transcribing audio to see your history here</p>
                </div>
              ) : (
                <>
                  {compressionHistory.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
                        <Film className="w-5 h-5 text-blue-600" />
                        Compression History
                      </h3>
                      <div className="space-y-3">
                        {compressionHistory.map((item) => (
                          <div key={item.id} className="bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-xl border border-blue-100 hover:border-blue-300 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900 truncate">{item.fileName}</p>
                                <p className="text-sm text-slate-600 mt-1">
                                  {formatSize(item.originalSize)} → {formatSize(item.compressedSize)} 
                                  <span className="text-green-600 font-semibold ml-2">({item.compression}% saved)</span>
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <a 
                                  href={item.downloadUrl} 
                                  download={`shrunken_${item.fileName}`}
                                  className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                                <button 
                                  onClick={() => deleteCompressionHistory(item.id)}
                                  className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {transcriptionHistory.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
                        <Mic className="w-5 h-5 text-blue-600" />
                        Transcription History
                      </h3>
                      <div className="space-y-3">
                        {transcriptionHistory.map((item) => (
                          <div key={item.id} className="bg-gradient-to-r from-purple-50 to-slate-50 p-4 rounded-xl border border-purple-100 hover:border-purple-300 transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900 truncate">{item.fileName}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <button 
                                onClick={() => deleteTranscriptionHistory(item.id)}
                                className="p-2.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-sm text-slate-700 mt-3 p-3 bg-white rounded-lg max-h-[120px] overflow-y-auto border border-slate-200">
                              {item.transcription}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(compressionHistory.length > 0 || transcriptionHistory.length > 0) && (
                    <button 
                      onClick={clearAllHistory}
                      className="w-full mt-8 px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-all text-sm uppercase tracking-wider"
                    >
                      Clear All History
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'compressor' ? (
            <motion.div 
              key="compressor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Compressor Content */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {!video ? (
                  <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
                    <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
                    <Upload className="w-12 h-12 mb-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <p className="text-xl font-medium text-slate-700">Drop Video File</p>
                    <p className="text-xs text-slate-500 font-mono mt-2">MP4, MOV up to 2GB</p>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoChange} />
                  </label>
                ) : (
                  <div className="bg-white rounded-lg p-6 shadow-md border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Film className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold truncate max-w-[200px] text-slate-700">{video.name}</h3>
                      </div>
                      <button onClick={() => setVideo(null)} className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-red-600 transition-all">Clear</button>
                    </div>
                    <div className="relative aspect-video rounded-lg bg-slate-900 overflow-hidden">
                      <video src={URL.createObjectURL(video)} className="w-full h-full object-contain" controls />
                      {status === 'compressing' && (
                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-8">
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between mb-2 text-slate-300 text-[10px] font-mono tracking-widest uppercase">
                              <span>Compressing</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" animate={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white rounded-lg p-8 shadow-md border border-slate-200 h-full">
                  <div className="flex items-center gap-2 mb-8">
                    <Settings2 className="w-4 h-4 text-slate-400" />
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Compression Settings</h2>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className="text-sm font-medium block mb-4 text-slate-700">Target Quality</label>
                      <input type="range" min="18" max="35" value={crf} onChange={(e) => setCrf(parseInt(e.target.value))} className="w-full accent-blue-600" />
                      <div className="flex justify-between mt-2 text-[10px] text-slate-500 uppercase tracking-tighter"><span>Source</span><span>Lite</span></div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-4 text-slate-700">Compression Speed</label>
                      <div className="flex gap-2">
                        {(['ultrafast', 'superfast', 'veryfast', 'fast'] as const).map(p => (
                          <button key={p} onClick={() => setPreset(p)} className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${preset === p ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{p}</button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">Faster = Quicker Encoding</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-4 text-slate-700">Resolution</label>
                      <div className="flex gap-2">
                        {['original', '720p', '480p'].map(res => (
                          <button key={res} onClick={() => setScale(res)} className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${scale === res ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{res}</button>
                        ))}
                      </div>
                    </div>
                    {errorMessage && (
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-sm">{errorMessage}</div>
                      </div>
                    )}
                    <button 
                      disabled={!video || !loaded || status === 'compressing'}
                      onClick={compressVideo} 
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-lg font-bold flex items-center justify-center gap-3 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-md"
                    >
                      {status === 'compressing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      {status === 'compressing' ? 'SHRINKING...' : 'START COMPRESSION'}
                    </button>
                  </div>

                  {status === 'completed' && outputUrl && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 pt-8 border-t border-slate-200">
                      <div className="bg-gradient-to-r from-blue-50 to-slate-50 p-5 rounded-lg flex items-center justify-between mb-4 border border-slate-200">
                        <div>
                          <p className="text-[10px] text-slate-600 uppercase font-mono tracking-widest">Shrunk to</p>
                          <p className="text-sm font-bold text-slate-900">{formatSize(compressedSize!)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-600 uppercase font-mono tracking-widest">Savings</p>
                          <p className="text-sm font-bold text-green-600">{Math.round(((video!.size - compressedSize!) / video!.size) * 100)}%</p>
                        </div>
                      </div>
                      <a href={outputUrl} download={`shrunken_${video?.name}`} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-blue-600 text-blue-600 py-5 rounded-lg font-bold hover:bg-blue-50 transition-all">
                        <Download className="w-5 h-5" /> DOWNLOAD MP4
                      </a>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="transcribe"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Transcriber Content */}
              <div className="lg:col-span-12">
                <div className="bg-white rounded-lg p-8 lg:p-12 shadow-md border border-slate-200 min-h-[400px] flex flex-col">
                  {!transcriptionResult && transcriptionStatus !== 'transcribing' ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <label className="group relative flex flex-col items-center justify-center w-full max-w-xl aspect-21/9 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
                        <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
                        {audioFile ? (
                          <div className="flex flex-col items-center">
                            <FileAudio className="w-12 h-12 mb-4 text-slate-400" />
                            <p className="text-sm font-bold text-slate-700">{audioFile.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-1 uppercase">{formatSize(audioFile.size)} • {audioFile.type}</p>
                            <button 
                              onClick={(e) => { e.preventDefault(); setAudioFile(null); }}
                              className="mt-4 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:underline"
                            >
                              Change File
                            </button>
                          </div>
                        ) : (
                          <>
                            <FileAudio className="w-12 h-12 mb-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            <p className="text-xl font-medium text-slate-700">Select Audio File</p>
                            <p className="text-xs text-slate-500 font-mono mt-2 uppercase tracking-tighter">MP3, WAV, AAC, etc.</p>
                          </>
                        )}
                        <input type="file" className="hidden" accept="audio/*" onChange={handleAudioChange} />
                      </label>
                      {audioFile && (
                        <div className="flex gap-3 mt-12">
                          <motion.button 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={transcribeAudio}
                            disabled={transcriptionStatus === 'transcribing'}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-12 py-5 rounded-lg font-bold flex items-center justify-center gap-4 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50"
                          >
                            <MessageSquare className="w-5 h-5" />
                            {transcriptionStatus === 'transcribing' ? 'TRANSCRIBING...' : 'TRANSCRIBE WITH GEMINI AI'}
                          </motion.button>
                          {transcriptionStatus === 'transcribing' && (
                            <motion.button 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={cancelTranscription}
                              className="px-6 bg-red-600 text-white py-5 rounded-lg font-bold hover:bg-red-700 transition-all"
                            >
                              CANCEL
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : transcriptionStatus === 'transcribing' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                      <div className="relative mb-12">
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-blue-600/10 scale-150"
                          animate={{ scale: [1.2, 2, 1.2], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <div className="relative p-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg text-white">
                          <RefreshCw className="w-10 h-10 animate-spin" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900">Gemini is Listening...</h2>
                      <p className="text-sm text-slate-600 font-mono max-w-sm tracking-wide uppercase">Processing audio waves into text data via Google GenAI</p>
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={cancelTranscription}
                        className="mt-8 px-8 bg-red-600 text-white py-4 rounded-lg font-bold hover:bg-red-700 transition-all"
                      >
                        CANCEL TRANSCRIPTION
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-blue-100 to-slate-100 rounded-lg">
                            <Type className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">Transcription Result</h3>
                            <p className="text-sm font-bold text-slate-900">{audioFile?.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={copyTranscription}
                            className="p-3 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <button 
                            onClick={() => { setTranscriptionResult(null); setTranscriptionStatus('idle'); }}
                            className="p-3 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"
                          >
                            New Transcription
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-8 overflow-y-auto max-h-[500px] border border-slate-200">
                        <div className="text-lg leading-relaxed text-slate-800 whitespace-pre-wrap font-serif italic">
                          {transcriptionResult}
                        </div>
                      </div>
                    </div>
                  )}

                  {transcriptionStatus === 'error' && (
                    <div className="mt-8 p-6 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 shrink-0" />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest mb-1">AI Service Error</p>
                        <p className="text-sm leading-relaxed font-mono">{transcribeError}</p>
                        <button onClick={transcribeAudio} className="mt-4 text-xs font-bold underline hover:no-underline uppercase tracking-[0.2em]">Retry Operation</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-slate-200 pt-8 gap-6 pb-12">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em] bg-white px-5 py-2.5 rounded-full border border-slate-300 shadow-sm">
              <Info className="w-3 h-3" />
              Direct Media Pipeline
            </div>
            {activeTab === 'transcribe' && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-green-700 uppercase tracking-[0.2em] bg-green-50 px-5 py-2.5 rounded-full border border-green-200">
                AI ACTIVE
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] text-center md:text-right">
            {activeTab === 'compressor' ? 'FFMPEG.WASM ENGINE • LOCAL NODE' : 'GOOGLE GEMINI 1.5 FLASH • CLOUD NODE'}
          </div>
        </footer>
      </div>
    </div>
  );
}

