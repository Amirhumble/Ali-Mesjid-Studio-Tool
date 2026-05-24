import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useTranslation } from 'react-i18next';
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
  X,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clipShrinkLogo from './assets/clipShrinkLogo.jpg';

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
  const { t, i18n } = useTranslation();
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
      {/* Mobile-First Responsive Navigation Bar */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5">
          {/* Top Row: Logo and Actions */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
            {/* Logo - Responsive sizing */}
            <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
              <img 
                src={clipShrinkLogo} 
                alt={t('app.logo_alt')} 
                className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-lg md:rounded-xl shadow-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent truncate leading-tight">{t('app.title')}</h1>
                <p className="text-xs sm:text-xs md:text-sm text-slate-500 font-medium hidden sm:block truncate">{t('app.subtitle')}</p>
              </div>
            </div>

            {/* Right Actions - Touch-friendly buttons (minimum 44x44px) */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 flex-shrink-0">
              <button 
                onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')}
                className="h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation"
                title="Switch Language"
              >
                <Languages className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                <span className="hidden md:inline text-xs md:text-sm">{i18n.language === 'en' ? 'Amharic' : 'English'}</span>
              </button>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation ${
                  showHistory
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={t('app.history')}
              >
                <Clock className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
                <span className="hidden md:inline text-xs md:text-sm">{t('app.history')}</span>
              </button>
            </div>
          </div>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100/50 p-2 rounded-xl mt-4">
            <button 
              onClick={() => setActiveTab('compressor')}
              className={`px-4 md:px-5 lg:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-11 md:h-12 lg:h-13 touch-manipulation ${
                activeTab === 'compressor' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              {t('app.compressor')}
            </button>
            <button 
              onClick={() => setActiveTab('transcribe')}
              className={`px-4 md:px-5 lg:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-11 md:h-12 lg:h-13 touch-manipulation ${
                activeTab === 'transcribe' 
                  ? 'bg-white text-blue-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              {t('app.transcriber')}
            </button>
          </div>

          {/* Mobile Navigation - Stacks vertically */}
          <div className="md:hidden flex gap-2 mt-3 sm:mt-3.5">
            <button 
              onClick={() => setActiveTab('compressor')}
              className={`flex-1 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'compressor' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Film className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate text-xs sm:text-sm">{t('app.compressor')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('transcribe')}
              className={`flex-1 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'transcribe' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Mic className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate text-xs sm:text-sm">{t('app.transcriber')}</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10">

        {/* History Modal - Full-screen on mobile, near-full on desktop */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-4 lg:p-6"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5 sm:mb-6 md:mb-8 gap-3">
                <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
                  <img 
                    src={clipShrinkLogo} 
                    alt="Ali Mesjid Studio Tool Logo" 
                    className="w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 rounded-lg shadow-md object-cover flex-shrink-0"
                  />
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">{t('history.title')}</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-all flex-shrink-0 active:scale-95 touch-manipulation"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                </button>
              </div>

              {compressionHistory.length === 0 && transcriptionHistory.length === 0 ? (
                <div className="text-center py-8 sm:py-10 md:py-12 lg:py-16">
                  <Clock className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 text-slate-300 mx-auto mb-3 sm:mb-4 md:mb-5" />
                  <p className="text-base sm:text-lg md:text-xl text-slate-500 font-medium">{t('history.no_history')}</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 md:mt-3">{t('history.no_history_hint')}</p>
                </div>
              ) : (
                <>
                  {compressionHistory.length > 0 && (
                    <div className="mb-6 sm:mb-7 md:mb-8 lg:mb-10">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900">
                        <Film className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />
                        {t('history.compression_history')}
                      </h3>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        {compressionHistory.map((item) => (
                          <div key={item.id} className="bg-gradient-to-r from-blue-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-blue-100 hover:border-blue-300 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1 md:mt-2">
                                  {formatSize(item.originalSize)} → {formatSize(item.compressedSize)} 
                                  <span className="text-green-600 font-semibold ml-2">({item.compression}% {t('history.saved')})</span>
                                </p>
                                <p className="text-xs text-slate-500 mt-1 md:mt-2">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <a 
                                  href={item.downloadUrl} 
                                  download={`shrunken_${item.fileName}`}
                                  className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95 touch-manipulation"
                                  title={t('compressor.download_mp4')}
                                >
                                  <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                </a>
                                <button 
                                  onClick={() => deleteCompressionHistory(item.id)}
                                  className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all active:scale-95 touch-manipulation"
                                  title={t('compressor.clear')}
                                >
                                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
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
                      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900">
                        <Mic className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />
                        {t('history.transcription_history')}
                      </h3>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        {transcriptionHistory.map((item) => (
                          <div key={item.id} className="bg-gradient-to-r from-purple-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-purple-100 hover:border-purple-300 transition-all">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p>
                                <p className="text-xs text-slate-500 mt-1 md:mt-2">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <button 
                                onClick={() => deleteTranscriptionHistory(item.id)}
                                className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all flex-shrink-0 active:scale-95 touch-manipulation"
                                title={t('compressor.clear')}
                              >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                              </button>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-700 mt-3 p-3 sm:p-4 bg-white rounded-lg max-h-[140px] overflow-y-auto border border-slate-200">
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
                      className="w-full mt-6 sm:mt-7 md:mt-8 lg:mt-10 h-11 sm:h-12 md:h-13 px-4 py-2 sm:py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-all text-xs sm:text-sm uppercase tracking-wider active:scale-95 touch-manipulation"
                    >
                      {t('history.clear_all')}
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
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6 lg:gap-8"
            >
              {/* Compressor Content - Full width on mobile */}
              <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 md:gap-6">
                {!video ? (
                  <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg sm:rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px] sm:min-h-[240px] md:min-h-[280px]">
                    <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
                    <Upload className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 mb-3 sm:mb-4 md:mb-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-medium text-slate-700 px-4 text-center">{t('compressor.drop_file')}</p>
                    <p className="text-xs sm:text-sm text-slate-500 font-mono mt-2 md:mt-3">{t('compressor.file_hint')}</p>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoChange} />
                  </label>
                ) : (
                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
                    <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6 gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
                        <Film className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm md:text-base font-bold truncate text-slate-700">{video.name}</h3>
                      </div>
                      <button onClick={() => setVideo(null)} className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:text-red-600 transition-all flex-shrink-0 h-11 px-3 flex items-center justify-center hover:bg-red-50 rounded-lg active:scale-95 touch-manipulation">{t('compressor.clear')}</button>
                    </div>
                    <div className="relative aspect-video rounded-lg sm:rounded-xl md:rounded-2xl bg-slate-900 overflow-hidden">
                      <video src={URL.createObjectURL(video)} className="w-full h-full object-contain" controls />
                      {status === 'compressing' && (
                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 sm:p-8 md:p-10">
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between mb-2 text-slate-300 text-xs sm:text-sm font-mono tracking-widest uppercase">
                              <span>{t('compressor.compressing')}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" animate={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings Panel - Stacks below on mobile */}
              <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5 md:gap-6">
                <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
                  <div className="flex items-center gap-2 mb-6 sm:mb-7 md:mb-8">
                    <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t('compressor.settings')}</h2>
                  </div>
                  <div className="space-y-6 sm:space-y-7 md:space-y-8">
                    <div>
                      <label className="text-xs sm:text-sm font-medium block mb-3 sm:mb-4 text-slate-700">{t('compressor.target_quality')}</label>
                      <input type="range" min="18" max="35" value={crf} onChange={(e) => setCrf(parseInt(e.target.value))} className="w-full accent-blue-600 h-2 sm:h-2.5 cursor-pointer" />
                      <div className="flex justify-between mt-2 text-xs text-slate-500 uppercase tracking-tighter"><span>{t('compressor.source')}</span><span>{t('compressor.lite')}</span></div>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-medium block mb-3 sm:mb-4 text-slate-700">{t('compressor.compression_speed')}</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                        {(['ultrafast', 'superfast', 'veryfast', 'fast'] as const).map(p => (
                          <button key={p} onClick={() => setPreset(p)} className={`h-11 sm:h-12 py-2 sm:py-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${preset === p ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{p}</button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 md:mt-3 font-mono">{t('compressor.speed_hint')}</p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-medium block mb-3 sm:mb-4 text-slate-700">{t('compressor.resolution')}</label>
                      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                        {['original', '720p', '480p'].map(res => (
                          <button key={res} onClick={() => setScale(res)} className={`h-11 sm:h-12 py-2 sm:py-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${scale === res ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{res}</button>
                        ))}
                      </div>
                    </div>
                    {errorMessage && (
                      <div className="p-3 sm:p-4 md:p-5 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5 flex-shrink-0" />
                        <div className="text-xs sm:text-sm">{errorMessage}</div>
                      </div>
                    )}
                    <button 
                      disabled={!video || !loaded || status === 'compressing'}
                      onClick={compressVideo} 
                      className="w-full h-12 sm:h-13 md:h-14 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 sm:py-3.5 md:py-4 rounded-lg font-bold flex items-center justify-center gap-2 sm:gap-3 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-md active:scale-95 text-sm sm:text-base touch-manipulation"
                    >
                      {status === 'compressing' ? <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" /> : <Play className="w-4 sm:w-5 h-4 sm:h-5 fill-current" />}
                      {status === 'compressing' ? t('compressor.shrinking') : t('compressor.start_compression')}
                    </button>
                  </div>

                  {status === 'completed' && outputUrl && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 sm:mt-7 md:mt-8 pt-6 sm:pt-7 md:pt-8 border-t border-slate-200">
                      <div className="bg-gradient-to-r from-blue-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 border border-slate-200">
                        <div>
                          <p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t('compressor.shrunk_to')}</p>
                          <p className="text-sm sm:text-base md:text-lg font-bold text-slate-900">{formatSize(compressedSize!)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t('compressor.savings')}</p>
                          <p className="text-sm sm:text-base md:text-lg font-bold text-green-600">{Math.round(((video!.size - compressedSize!) / video!.size) * 100)}%</p>
                        </div>
                      </div>
                      <a href={outputUrl} download={`shrunken_${video!.name}`} className="w-full h-12 sm:h-13 md:h-14 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 sm:gap-3 hover:from-green-700 hover:to-green-800 transition-all shadow-md active:scale-95 text-sm sm:text-base touch-manipulation">
                        <Download className="w-4 sm:w-5 h-4 sm:h-5" /> {t('compressor.download_mp4')}
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
              className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 lg:gap-8"
            >
              {/* Transcriber Content - Full width */}
              <div className="w-full">
                <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 xl:p-12 shadow-md border border-slate-200 min-h-[400px] flex flex-col">
                  {!transcriptionResult && transcriptionStatus !== 'transcribing' ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <label className="group relative flex flex-col items-center justify-center w-full max-w-2xl aspect-21/9 border-2 border-dashed border-slate-300 rounded-lg sm:rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px] sm:min-h-[240px] md:min-h-[280px]">
                        <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
                        {audioFile ? (
                          <div className="flex flex-col items-center px-4">
                            <FileAudio className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 mb-3 sm:mb-4 md:mb-5 text-slate-400" />
                            <p className="text-sm sm:text-base md:text-lg font-bold text-slate-700 text-center truncate max-w-xs">{audioFile.name}</p>
                            <p className="text-xs text-slate-500 font-mono tracking-widest mt-1 md:mt-2 uppercase">{formatSize(audioFile.size)} • {audioFile.type}</p>
                            <button 
                              onClick={(e) => { e.preventDefault(); setAudioFile(null); }}
                              className="mt-4 md:mt-5 text-xs font-bold uppercase tracking-widest text-red-600 hover:underline active:scale-95 touch-manipulation"
                            >
                              {t('compressor.clear')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <FileAudio className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 mb-3 sm:mb-4 md:mb-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-medium text-slate-700 px-4 text-center">{t('transcriber.select_file')}</p>
                            <p className="text-xs sm:text-sm text-slate-500 font-mono mt-2 md:mt-3 uppercase tracking-tighter">{t('transcriber.file_hint')}</p>
                          </>
                        )}
                        <input type="file" className="hidden" accept="audio/*" onChange={handleAudioChange} />
                      </label>
                      {audioFile && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 mt-8 sm:mt-10 md:mt-12 w-full max-w-2xl">
                          <motion.button 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={transcribeAudio}
                            disabled={transcriptionStatus === 'transcribing'}
                            className="flex-1 h-12 sm:h-13 md:h-14 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 sm:px-8 md:px-12 py-3 sm:py-3.5 md:py-4 rounded-lg font-bold flex items-center justify-center gap-2 sm:gap-3 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 active:scale-95 text-sm sm:text-base touch-manipulation"
                          >
                            <MessageSquare className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 flex-shrink-0" />
                            {transcriptionStatus === 'transcribing' ? t('transcriber.transcribing') : t('transcriber.transcribe_ai')}
                          </motion.button>
                          {transcriptionStatus === 'transcribing' && (
                            <motion.button 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={cancelTranscription}
                              className="h-12 sm:h-13 md:h-14 px-4 sm:px-6 md:px-8 bg-red-600 text-white py-3 sm:py-3.5 md:py-4 rounded-lg font-bold hover:bg-red-700 transition-all active:scale-95 text-sm sm:text-base flex-shrink-0 touch-manipulation"
                            >
                              {t('transcriber.cancel')}
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : transcriptionStatus === 'transcribing' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 lg:p-12">
                      <div className="relative mb-8 sm:mb-10 md:mb-12 lg:mb-16">
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-blue-600/10 scale-150"
                          animate={{ scale: [1.2, 2, 1.2], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <div className="relative p-6 sm:p-7 md:p-8 lg:p-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg text-white">
                          <RefreshCw className="w-8 sm:w-9 md:w-10 lg:w-12 h-8 sm:h-9 md:h-10 lg:h-12 animate-spin" />
                        </div>
                      </div>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-2 md:mb-3 text-slate-900">{t('transcriber.gemini_listening')}</h2>
                      <p className="text-xs sm:text-sm text-slate-600 font-mono max-w-sm md:max-w-md tracking-wide uppercase">{t('transcriber.gemini_hint')}</p>
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={cancelTranscription}
                        className="mt-6 sm:mt-8 md:mt-10 lg:mt-12 h-11 sm:h-12 md:h-13 px-6 sm:px-8 md:px-10 bg-red-600 text-white py-2 sm:py-3 md:py-3.5 rounded-lg font-bold hover:bg-red-700 transition-all active:scale-95 text-sm sm:text-base touch-manipulation"
                      >
                        {t('transcriber.cancel_transcription')}
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 md:gap-5 mb-6 sm:mb-7 md:mb-8 pb-4 sm:pb-5 md:pb-6 border-b border-slate-200">
                        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                          <div className="p-2 sm:p-2.5 md:p-3 bg-gradient-to-br from-blue-100 to-slate-100 rounded-lg flex-shrink-0">
                            <Type className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">{t('transcriber.result')}</h3>
                            <p className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">{audioFile?.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:gap-2.5 md:gap-3 flex-shrink-0">
                          <button 
                            onClick={copyTranscription}
                            className="h-11 sm:h-12 md:h-13 px-2 sm:px-3 md:px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation"
                            title={t('transcriber.copy')}
                          >
                            <Copy className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            <span className="hidden sm:inline text-xs md:text-sm">{t('transcriber.copy')}</span>
                          </button>
                          <button 
                            onClick={() => { setTranscriptionResult(null); setTranscriptionStatus('idle'); }}
                            className="h-11 sm:h-12 md:h-13 px-2 sm:px-3 md:px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation"
                          >
                            <span className="hidden sm:inline text-xs md:text-sm">{t('transcriber.new_transcription')}</span>
                            <span className="sm:hidden text-xs">New</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 overflow-y-auto max-h-[500px] border border-slate-200">
                        <div className="text-base sm:text-lg md:text-xl leading-relaxed md:leading-loose text-slate-800 whitespace-pre-wrap font-serif italic">
                          {transcriptionResult}
                        </div>
                      </div>
                    </div>
                  )}

                  {transcriptionStatus === 'error' && (
                    <div className="mt-6 sm:mt-7 md:mt-8 p-4 sm:p-5 md:p-6 bg-red-50 rounded-lg sm:rounded-xl md:rounded-2xl border border-red-200 text-red-700 flex items-start gap-3 sm:gap-4 md:gap-5">
                      <AlertCircle className="w-5 sm:w-6 md:w-7 h-5 sm:h-6 md:h-7 shrink-0 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2">{t('transcriber.error_title')}</p>
                        <p className="text-xs sm:text-sm leading-relaxed font-mono">{transcribeError}</p>
                        <button onClick={transcribeAudio} className="mt-3 sm:mt-4 md:mt-5 text-xs font-bold underline hover:no-underline uppercase tracking-[0.2em] active:scale-95 touch-manipulation">{t('transcriber.retry')}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 sm:mt-14 md:mt-16 lg:mt-20 border-t border-slate-200/50 pt-8 sm:pt-10 md:pt-12 lg:pt-16 pb-6 sm:pb-8 md:pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8 lg:gap-10 mb-6 sm:mb-8 md:mb-10">
            {/* Brand Section */}
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <img 
                  src={clipShrinkLogo} 
                  alt="Ali Mesjid Studio Tool" 
                  className="w-7 sm:w-8 md:w-9 h-7 sm:h-8 md:h-9 rounded-lg object-cover flex-shrink-0"
                />
                <h3 className="font-bold text-sm sm:text-base md:text-lg text-slate-900">Ali Mesjid Studio Tool</h3>
              </div>
              <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed">Professional media compression and AI transcription platform</p>
            </div>

            {/* Features Section */}
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
              <h4 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-base uppercase tracking-wider">Features</h4>
              <ul className="space-y-1 sm:space-y-2 md:space-y-2.5 text-xs sm:text-sm md:text-base text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                  <span>Video Compression</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                  <span>Audio Transcription</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                  <span>History & Storage</span>
                </li>
              </ul>
            </div>

            {/* Tech Stack Section */}
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
              <h4 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-base uppercase tracking-wider">Technology</h4>
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                <span className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-medium">React</span>
                <span className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-medium">TypeScript</span>
                <span className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-medium">FFmpeg</span>
                <span className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-medium">Gemini AI</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200/50 my-6 sm:my-7 md:my-8 lg:my-10"></div>

          {/* Bottom Section - Stacks on mobile */}
          <div className="flex flex-col gap-4 sm:gap-5 md:gap-6">
            {/* Status Badges */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-4">
              <div className="flex items-center gap-2 text-xs md:text-sm font-mono text-slate-600 bg-slate-100 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 rounded-lg border border-slate-200 h-11 sm:h-12 md:h-13 flex-shrink-0 touch-manipulation">
                <Info className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs md:text-sm">Direct Media Pipeline</span>
                <span className="sm:hidden text-xs">Media Pipeline</span>
              </div>
              {activeTab === 'transcribe' && (
                <div className="flex items-center gap-2 text-xs md:text-sm font-mono text-green-700 bg-green-50 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 rounded-lg border border-green-200 h-11 sm:h-12 md:h-13 touch-manipulation">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse flex-shrink-0"></span>
                  <span className="text-xs md:text-sm">AI Active</span>
                </div>
              )}
            </div>

            {/* Engine Info */}
            <div className="text-xs md:text-sm font-mono text-slate-500 text-center sm:text-left">
              {activeTab === 'compressor' ? 'FFMPEG.WASM ENGINE • LOCAL NODE' : 'GOOGLE GEMINI 2.0 FLASH • CLOUD NODE'}
            </div>

            {/* Developer Credit - Always visible */}
            <div className="text-xs md:text-sm text-slate-600 text-center sm:text-left">
              Developed by <span className="font-semibold text-slate-900">Amir Tofik</span>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs md:text-sm text-slate-500 mt-6 sm:mt-7 md:mt-8 lg:mt-10 pt-4 sm:pt-5 md:pt-6 border-t border-slate-200/50">
            © 2024 Ali Mesjid Studio Tool. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

