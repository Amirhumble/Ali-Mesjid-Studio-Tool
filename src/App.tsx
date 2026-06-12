import { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react';
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
  Languages,
  Video,
} from 'lucide-react';
import { motion } from 'motion/react';
import clipShrinkLogo from './assets/clipShrinkLogo.jpg';
import SubtitleStudio from './features/captioning/pages/SubtitleStudio';
import ScrollToTop from './components/ScrollToTop';

type CompressionStatus = 'idle' | 'loading' | 'compressing' | 'completed' | 'error';
type TranscriptionStatus = 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
type AppTab = 'compressor' | 'transcribe' | 'subtitleStudio';

type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
};

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
  
  // Initialize tab from URL hash if present
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const hash = window.location.hash.replace('#', '') as AppTab;
    return ['compressor', 'transcribe', 'subtitleStudio'].includes(hash) ? hash : 'compressor';
  });
  
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
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [initialEstimate, setInitialEstimate] = useState<number | null>(null);

  // Transcriber State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>('idle');
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const isTranscribing = transcriptionStatus === 'transcribing';

  // History State
  const [compressionHistory, setCompressionHistory] = useState<CompressionHistory[]>([]);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const transcriptionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadFFmpeg();
    loadHistory();

    // Sync activeTab with hash changes (Back/Forward navigation)
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as AppTab;
      if (['compressor', 'transcribe', 'subtitleStudio'].includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
    window.scrollTo(0, 0);
  }, [activeTab]);

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
      setErrorMessage('Failed to load FFmpeg. Check your internet connection.');
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
    
    const updated = [newEntry, ...compressionHistory].slice(0, 20); 
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
    
    const updated = [newEntry, ...transcriptionHistory].slice(0, 20); 
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
    setInitialEstimate(estimatedSize);
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

  const estimatedSize = useMemo(() => {
    if (!video || !videoMetadata) return null;
    const { duration, width, height } = videoMetadata;
    const baseBitrate = 4000000; 
    let targetW = width;
    let targetH = height;
    if (scale === '720p' && height > 720) {
      targetH = 720;
      targetW = (width * 720) / height;
    } else if (scale === '480p' && height > 480) {
      targetH = 480;
      targetW = (width * 480) / height;
    }
    const resolutionFactor = (targetW * targetH) / (1920 * 1080);
    const crfFactor = Math.pow(2, (23 - crf) / 6);
    const presetMultipliers = { ultrafast: 1.35, superfast: 1.25, veryfast: 1.15, fast: 1.05 };
    const presetFactor = presetMultipliers[preset];
    const audioBitrate = 128000;
    const estBitrate = baseBitrate * resolutionFactor * crfFactor * presetFactor;
    const totalBytes = ((estBitrate + audioBitrate) * duration) / 8;
    return Math.min(totalBytes, video.size * 0.95);
  }, [video, videoMetadata, crf, scale, preset]);

  const qualityLabel = useMemo(() => {
    if (crf <= 21) return t('compressor.quality_excellent');
    if (crf <= 26) return t('compressor.quality_high');
    if (crf <= 31) return t('compressor.quality_medium');
    return t('compressor.quality_low');
  }, [crf, t]);

  const presetGuidance = useMemo(() => {
    if (crf <= 21) return t('compressor.preset_guidance_original');
    if (crf <= 26) return t('compressor.preset_guidance_high');
    if (crf <= 31) return t('compressor.preset_guidance_balanced');
    return t('compressor.preset_guidance_smaller');
  }, [crf, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <ScrollToTop />
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5">
          <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
              <img src={clipShrinkLogo} alt={t('app.logo_alt')} className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-lg md:rounded-xl shadow-lg object-cover flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent truncate leading-tight">{t('app.title')}</h1>
                <p className="text-xs sm:text-xs md:text-sm text-slate-500 font-medium hidden sm:block truncate">{t('app.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 flex-shrink-0">
              <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')} className="h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation">
                <Languages className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                <span className="hidden md:inline text-xs md:text-sm">{i18n.language === 'en' ? 'Amharic' : 'English'}</span>
              </button>
              <button onClick={() => setShowHistory(!showHistory)} className={`h-11 w-11 sm:h-12 sm:w-auto sm:px-3 md:px-4 md:h-12 lg:h-13 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm hover:shadow-md active:scale-95 touch-manipulation ${showHistory ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                <Clock className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
                <span className="hidden md:inline text-xs md:text-sm">{t('app.history')}</span>
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-100/50 p-2 rounded-xl mt-4">
            <button onClick={() => setActiveTab('compressor')} className={`px-4 md:px-5 lg:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-11 md:h-12 lg:h-13 touch-manipulation ${activeTab === 'compressor' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>
              <Film className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" /> {t('app.compressor')}
            </button>
            <button onClick={() => setActiveTab('transcribe')} className={`px-4 md:px-5 lg:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-11 md:h-12 lg:h-13 touch-manipulation ${activeTab === 'transcribe' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>
              <Mic className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" /> {t('app.transcriber')}
            </button>
            <button onClick={() => setActiveTab('subtitleStudio')} className={`px-4 md:px-5 lg:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-11 md:h-12 lg:h-13 touch-manipulation ${activeTab === 'subtitleStudio' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>
              <Video className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" /> {t('app.subtitleStudio')}
            </button>
          </div>
          <div className="md:hidden flex gap-2 mt-3 sm:mt-3.5">
            <button onClick={() => setActiveTab('compressor')} className={`flex-1 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'compressor' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Film className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" /><span className="truncate text-xs sm:text-sm">{t('app.compressor')}</span>
            </button>
            <button onClick={() => setActiveTab('transcribe')} className={`flex-1 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'transcribe' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Mic className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" /><span className="truncate text-xs sm:text-sm">{t('app.transcriber')}</span>
            </button>
            <button onClick={() => setActiveTab('subtitleStudio')} className={`flex-1 h-11 sm:h-12 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation ${activeTab === 'subtitleStudio' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Video className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" /><span className="truncate text-xs sm:text-sm">{t('app.subtitleStudio')}</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10">
        {showHistory && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-4 lg:p-6" onClick={() => setShowHistory(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-3xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-5 sm:mb-6 md:mb-8 gap-3">
                <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
                  <img src={clipShrinkLogo} alt="Logo" className="w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 rounded-lg shadow-md object-cover flex-shrink-0" />
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">{t('history.title')}</h2>
                </div>
                <button onClick={() => setShowHistory(false)} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-all flex-shrink-0 active:scale-95 touch-manipulation">
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                </button>
              </div>
              {compressionHistory.length === 0 && transcriptionHistory.length === 0 ? (
                <div className="text-center py-8 sm:py-10 md:py-12 lg:py-16">
                  <Clock className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 text-slate-300 mx-auto mb-3 sm:mb-4 md:mb-5" />
                  <p className="text-base sm:text-lg md:text-xl text-slate-500 font-medium">{t('history.no_history')}</p>
                </div>
              ) : (
                <>
                  {compressionHistory.length > 0 && (
                    <div className="mb-6 sm:mb-7 md:mb-8 lg:mb-10">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900"><Film className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />{t('history.compression_history')}</h3>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        {compressionHistory.map(item => (
                          <div key={item.id} className="bg-gradient-to-r from-blue-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-blue-100 hover:border-blue-300 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1 md:mt-2">{formatSize(item.originalSize)} → {formatSize(item.compressedSize)} <span className="text-green-600 font-semibold ml-2">({item.compression}% {t('history.saved')})</span></p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <a href={item.downloadUrl} download={`shrunken_${item.fileName}`} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95 touch-manipulation"><Download className="w-4 h-4 sm:w-5 sm:h-5" /></a>
                                <button onClick={() => deleteCompressionHistory(item.id)} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all active:scale-95 touch-manipulation"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {transcriptionHistory.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 text-slate-900"><Mic className="w-4 sm:w-5 md:w-6 h-4 sm:h-5 md:h-6 text-blue-600 flex-shrink-0" />{t('history.transcription_history')}</h3>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        {transcriptionHistory.map(item => (
                          <div key={item.id} className="bg-gradient-to-r from-purple-50 to-slate-50 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl md:rounded-2xl border border-purple-100 hover:border-purple-300 transition-all">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex-1 min-w-0"><p className="font-semibold text-sm sm:text-base md:text-lg text-slate-900 truncate">{item.fileName}</p></div>
                              <button onClick={() => deleteTranscriptionHistory(item.id)} className="h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all flex-shrink-0 active:scale-95 touch-manipulation"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-700 p-3 bg-white rounded-lg max-h-[140px] overflow-y-auto border border-slate-200">{item.transcription}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={clearAllHistory} className="w-full mt-6 h-11 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-all text-xs uppercase tracking-wider active:scale-95 touch-manipulation">{t('history.clear_all')}</button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="relative">
          <div className={activeTab === 'compressor' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
              <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 md:gap-6">
                {!video ? (
                  <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg sm:rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px] sm:min-h-[240px] md:min-h-[280px]">
                    <div className="absolute inset-0 bg-[radial-gradient(#0f172a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.02]" />
                    <Upload className="w-10 sm:w-12 md:w-14 h-10 sm:h-12 md:h-14 mb-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <p className="text-base sm:text-lg md:text-xl font-medium text-slate-700 px-4 text-center">{t('compressor.drop_file')}</p>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoChange} />
                  </label>
                ) : (
                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Film className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <h3 className="text-xs sm:text-sm md:text-base font-bold truncate text-slate-700">{video.name}</h3>
                      </div>
                      <button onClick={() => setVideo(null)} className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:text-red-600 transition-all flex-shrink-0 h-11 px-3 flex items-center justify-center hover:bg-red-50 rounded-lg active:scale-95 touch-manipulation">{t('compressor.clear')}</button>
                    </div>
                    <div className="relative aspect-video rounded-lg sm:rounded-xl md:rounded-2xl bg-slate-900 overflow-hidden">
                      <video src={video ? URL.createObjectURL(video) : undefined} className="w-full h-full object-contain" controls onLoadedMetadata={(e) => { const v = e.currentTarget; setVideoMetadata({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }); }} />
                      {status === 'compressing' && (
                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6">
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between mb-2 text-slate-300 text-xs font-mono tracking-widest uppercase"><span>{t('compressor.compressing')}</span><span>{progress}%</span></div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" animate={{ width: `${progress}%` }} /></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5 md:gap-6">
                <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200">
                  <div className="flex items-center gap-2 mb-6"><Settings2 className="w-4 h-4 text-slate-400" /><h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t('compressor.settings')}</h2></div>
                  <div className="space-y-6">
                    <div><label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t('compressor.target_quality')}</label><input type="range" min="18" max="35" value={crf} onChange={(e) => setCrf(parseInt(e.target.value))} className="w-full accent-blue-600 h-2 cursor-pointer" /><div className="flex justify-between mt-2 text-xs text-slate-500 uppercase tracking-tighter"><span>{t('compressor.source')}</span><span>{t('compressor.lite')}</span></div></div>
                    <div><label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t('compressor.compression_speed')}</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['ultrafast', 'superfast', 'veryfast', 'fast'] as const).map(p => (<button key={p} onClick={() => setPreset(p)} className={`h-11 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${preset === p ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{p}</button>))}</div></div>
                    <div><label className="text-xs sm:text-sm font-medium block mb-3 text-slate-700">{t('compressor.resolution')}</label><div className="grid grid-cols-3 gap-2">{['original', '720p', '480p'].map(res => (<button key={res} onClick={() => setScale(res)} className={`h-11 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 touch-manipulation ${scale === res ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}>{res}</button>))}</div></div>
                    {errorMessage && (<div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-start gap-3"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><div className="text-xs sm:text-sm">{errorMessage}</div></div>)}
                    <button disabled={!video || !loaded || status === 'compressing'} onClick={compressVideo} className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-md active:scale-95 text-sm touch-manipulation">{status === 'compressing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}{status === 'compressing' ? t('compressor.shrinking') : t('compressor.start_compression')}</button>
                  </div>
                  {video && status === 'idle' && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                      <div className="flex items-center gap-2 mb-4"><Video className="w-4 h-4 text-blue-600" /><h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t('compressor.preview_title')}</h3></div>
                      <div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t('compressor.source_size')}</p><p className="text-sm font-bold text-slate-700">{formatSize(video.size)}</p></div><div><p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t('compressor.est_output_size')}</p><p className="text-sm font-bold text-blue-600">~{estimatedSize ? formatSize(estimatedSize) : '...'}</p></div></div></div>
                    </div>
                  )}
                  {video && status === 'completed' && outputUrl && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-lg space-y-4 mb-4 border border-slate-200"><div className="flex justify-between"><div><p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t('compressor.actual_size')}</p><p className="text-sm font-bold text-slate-900">{formatSize(compressedSize!)}</p></div><div><p className="text-xs text-slate-600 uppercase font-mono tracking-widest">{t('compressor.savings')}</p><p className="text-sm font-bold text-green-600">{Math.round(((video.size - compressedSize!) / video.size) * 100)}%</p></div></div></div>
                      <a href={outputUrl} download={`shrunken_${video.name}`} className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:from-green-700 hover:to-green-800 transition-all shadow-md active:scale-95 text-sm touch-manipulation"><Download className="w-4 h-4" /> {t('compressor.download_mp4')}</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={activeTab === 'transcribe' ? 'block' : 'hidden'}>
            <div className="w-full"><div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-md border border-slate-200 min-h-[400px] flex flex-col">
              {!transcriptionResult && transcriptionStatus !== 'transcribing' ? (
                <div className="flex-1 flex flex-col items-center justify-center"><label className="group relative flex flex-col items-center justify-center w-full max-w-2xl aspect-21/9 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all duration-500 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 min-h-[200px]"><FileAudio className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-600 transition-colors" /><p className="text-base font-medium text-slate-700 px-4 text-center">{t('transcriber.select_file')}</p><input type="file" className="hidden" accept="audio/*" onChange={handleAudioChange} /></label>
                {audioFile && (<div className="flex gap-3 mt-8 w-full max-w-2xl"><button onClick={transcribeAudio} disabled={isTranscribing} className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 active:scale-95 text-sm touch-manipulation"><MessageSquare className="w-4 h-4" />{isTranscribing ? t('transcriber.transcribing') : t('transcriber.transcribe_ai')}</button></div>)}</div>
              ) : transcriptionStatus === 'transcribing' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4"><RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-6" /><h2 className="text-2xl font-semibold mb-2 text-slate-900">{t('transcriber.gemini_listening')}</h2><button onClick={cancelTranscription} className="mt-6 h-11 px-8 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all active:scale-95 text-sm touch-manipulation">{t('transcriber.cancel')}</button></div>
              ) : (
                <div className="flex-1 flex flex-col h-full"><div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200"><div className="flex items-center gap-3"><Type className="w-5 h-5 text-blue-600" /><div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">{t('transcriber.result')}</h3><p className="text-sm font-bold text-slate-900 truncate">{audioFile?.name}</p></div></div><div className="flex gap-2"><button onClick={copyTranscription} className="h-11 px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation"><Copy className="w-4 h-4" /><span>{t('transcriber.copy')}</span></button><button onClick={() => { setTranscriptionResult(null); setTranscriptionStatus('idle'); }} className="h-11 px-4 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 active:scale-95 touch-manipulation">New</button></div></div><div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-6 overflow-y-auto border border-slate-200"><div className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap font-serif italic">{transcriptionResult}</div></div></div>
              )}
            </div></div>
          </div>

          <div className={activeTab === 'subtitleStudio' ? 'block' : 'hidden'}>
            <SubtitleStudio ffmpeg={ffmpegRef.current} />
          </div>
        </div>

        <footer className="mt-12 border-t border-slate-200/50 pt-8 pb-6">
          <div className="text-center text-xs text-slate-500">
            © 2024 Ali Mesjid Studio Tool. All rights reserved. Developed by <span className="font-semibold text-slate-900">Amir Tofik</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
