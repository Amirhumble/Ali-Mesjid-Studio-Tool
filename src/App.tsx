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
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CompressionStatus = 'idle' | 'loading' | 'compressing' | 'completed' | 'error';
type TranscriptionStatus = 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';
type AppTab = 'compressor' | 'transcribe';

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

  const ffmpegRef = useRef(new FFmpeg());
  const compressionAbortRef = useRef<AbortController | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadFFmpeg();
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
      // We only alert if they are actually in the compressor tab
      if (activeTab === 'compressor') {
        setErrorMessage('Failed to load FFmpeg. Check your internet connection.');
      }
    }
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
    
    // Create abort controller for this compression
    compressionAbortRef.current = new AbortController();

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
      
      // Check if compression was cancelled
      if (compressionAbortRef.current?.signal.aborted) {
        setStatus('idle');
        setProgress(0);
        return;
      }
      
      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([new Uint8Array(data as ArrayBuffer)], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setCompressedSize(blob.size);
      setStatus('completed');
    } catch (err) {
      console.error('Compression error:', err);
      if (compressionAbortRef.current?.signal.aborted) {
        setStatus('idle');
        setErrorMessage('Compression cancelled.');
      } else {
        setStatus('error');
        setErrorMessage('An error occurred during compression.');
      }
    } finally {
      compressionAbortRef.current = null;
    }
  };

  const cancelCompression = () => {
    if (compressionAbortRef.current) {
      compressionAbortRef.current.abort();
      const ffmpeg = ffmpegRef.current;
      ffmpeg.exit();
      setStatus('idle');
      setProgress(0);
      setErrorMessage('Compression cancelled by user.');
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
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-[#1a1a1a] selection:text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-[#1a1a1a] rounded-lg">
                {activeTab === 'compressor' ? <Film className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest opacity-50">ClipShrink Studio v1.1</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-[#1a1a1a]">
              ClipShrink
            </h1>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex bg-white p-1.5 rounded-2xl border border-[#1a1a1a]/5 self-start md:self-end">
            <button 
              onClick={() => setActiveTab('compressor')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'compressor' ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#f5f5f5] opacity-50 hover:opacity-100'
              }`}
            >
              <Film className="w-4 h-4" />
              Compressor
            </button>
            <button 
              onClick={() => setActiveTab('transcribe')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'transcribe' ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#f5f5f5] opacity-50 hover:opacity-100'
              }`}
            >
              <Mic className="w-4 h-4" />
              Transcriber
            </button>
          </nav>
        </header>

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
                  <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-[#1a1a1a]/10 rounded-3xl cursor-pointer hover:bg-white hover:border-[#1a1a1a]/30 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.03]" />
                    <Upload className="w-12 h-12 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xl font-medium">Drop Video File</p>
                    <p className="text-xs opacity-50 font-mono mt-2">MP4, MOV up to 2GB</p>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoChange} />
                  </label>
                ) : (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#1a1a1a]/5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Film className="w-4 h-4 opacity-30" />
                        <h3 className="text-xs font-bold truncate max-w-[200px]">{video.name}</h3>
                      </div>
                      <button onClick={() => setVideo(null)} className="text-[10px] uppercase font-bold tracking-widest opacity-30 hover:opacity-100 hover:text-red-500 transition-all">Clear</button>
                    </div>
                    <div className="relative aspect-video rounded-2xl bg-[#1a1a1a] overflow-hidden">
                      <video src={URL.createObjectURL(video)} className="w-full h-full object-contain" controls />
                      {status === 'compressing' && (
                        <div className="absolute inset-0 bg-[#1a1a1a]/90 flex flex-col items-center justify-center p-8">
                          <div className="w-full max-w-xs">
                            <div className="flex justify-between mb-2 text-white/50 text-[10px] font-mono tracking-widest uppercase">
                              <span>Compressing</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-white" animate={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#1a1a1a]/5 h-full">
                  <div className="flex items-center gap-2 mb-8">
                    <Settings2 className="w-4 h-4 opacity-30" />
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Compression Settings</h2>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className="text-sm font-medium block mb-4">Target Quality</label>
                      <input type="range" min="18" max="35" value={crf} onChange={(e) => setCrf(parseInt(e.target.value))} className="w-full accent-[#1a1a1a]" />
                      <div className="flex justify-between mt-2 text-[10px] opacity-40 uppercase tracking-tighter"><span>Source</span><span>Lite</span></div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-4">Compression Speed</label>
                      <div className="flex gap-2">
                        {(['ultrafast', 'superfast', 'veryfast', 'fast'] as const).map(p => (
                          <button key={p} onClick={() => setPreset(p)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${preset === p ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-[#1a1a1a]/10 hover:border-[#1a1a1a]/30'}`}>{p}</button>
                        ))}
                      </div>
                      <p className="text-[10px] opacity-40 mt-2 font-mono">Faster = Quicker Encoding</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-4">Resolution</label>
                      <div className="flex gap-2">
                        {['original', '720p', '480p'].map(res => (
                          <button key={res} onClick={() => setScale(res)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${scale === res ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-[#1a1a1a]/10 hover:border-[#1a1a1a]/30'}`}>{res}</button>
                        ))}
                      </div>
                    </div>
                    {errorMessage && (
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-sm">{errorMessage}</div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button 
                        disabled={!video || !loaded || status === 'compressing'}
                        onClick={compressVideo} 
                        className="flex-1 bg-[#1a1a1a] text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#333] transition-all disabled:opacity-20"
                      >
                        {status === 'compressing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        {status === 'compressing' ? 'SHRINKING...' : 'START COMPRESSION'}
                      </button>
                      {status === 'compressing' && (
                        <button 
                          onClick={cancelCompression}
                          className="px-6 bg-red-500 text-white py-5 rounded-2xl font-bold hover:bg-red-600 transition-all"
                        >
                          CANCEL
                        </button>
                      )}
                    </div>
                  </div>

                  {status === 'completed' && outputUrl && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 pt-8 border-t border-[#f5f5f5]">
                      <div className="bg-[#f5f5f5] p-5 rounded-2xl flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[10px] opacity-40 uppercase font-mono tracking-widest">Shrunk to</p>
                          <p className="text-sm font-bold">{formatSize(compressedSize!)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] opacity-40 uppercase font-mono tracking-widest">Savings</p>
                          <p className="text-sm font-bold text-green-600">{Math.round(((video!.size - compressedSize!) / video!.size) * 100)}%</p>
                        </div>
                      </div>
                      <a href={outputUrl} download={`shrunken_${video?.name}`} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#1a1a1a] py-5 rounded-2xl font-bold hover:bg-[#f5f5f5] transition-all">
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
                <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-sm border border-[#1a1a1a]/5 min-h-[400px] flex flex-col">
                  {!transcriptionResult && transcriptionStatus !== 'transcribing' ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <label className="group relative flex flex-col items-center justify-center w-full max-w-xl aspect-21/9 border-2 border-dashed border-[#1a1a1a]/10 rounded-3xl cursor-pointer hover:bg-[#f5f5f5] hover:border-[#1a1a1a]/30 transition-all duration-500 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] bg-size-[20px_20px] opacity-[0.03]" />
                        {audioFile ? (
                          <div className="flex flex-col items-center">
                            <FileAudio className="w-12 h-12 mb-4 text-[#1a1a1a]/40" />
                            <p className="text-sm font-bold">{audioFile.name}</p>
                            <p className="text-[10px] opacity-40 font-mono tracking-widest mt-1 uppercase">{formatSize(audioFile.size)} • {audioFile.type}</p>
                            <button 
                              onClick={(e) => { e.preventDefault(); setAudioFile(null); }}
                              className="mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:underline"
                            >
                              Change File
                            </button>
                          </div>
                        ) : (
                          <>
                            <FileAudio className="w-12 h-12 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                            <p className="text-xl font-medium">Select Audio File</p>
                            <p className="text-xs opacity-50 font-mono mt-2 uppercase tracking-tighter">MP3, WAV, AAC, etc.</p>
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
                            className="flex-1 bg-[#1a1a1a] text-white px-12 py-5 rounded-2xl font-bold flex items-center justify-center gap-4 hover:bg-[#333] transition-all shadow-xl shadow-[#1a1a1a]/20 disabled:opacity-50"
                          >
                            <MessageSquare className="w-5 h-5" />
                            {transcriptionStatus === 'transcribing' ? 'TRANSCRIBING...' : 'TRANSCRIBE WITH GEMINI AI'}
                          </motion.button>
                          {transcriptionStatus === 'transcribing' && (
                            <motion.button 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={cancelTranscription}
                              className="px-6 bg-red-500 text-white py-5 rounded-2xl font-bold hover:bg-red-600 transition-all"
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
                          className="absolute inset-0 rounded-full bg-[#1a1a1a]/5 scale-150"
                          animate={{ scale: [1.2, 2, 1.2], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <div className="relative p-8 bg-[#1a1a1a] rounded-3xl text-white">
                          <RefreshCw className="w-10 h-10 animate-spin" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2">Gemini is Listening...</h2>
                      <p className="text-sm opacity-50 font-mono max-w-sm tracking-wide uppercase">Processing audio waves into text data via Google GenAI</p>
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={cancelTranscription}
                        className="mt-8 px-8 bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all"
                      >
                        CANCEL TRANSCRIPTION
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#1a1a1a]/5">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-[#f5f5f5] rounded-2xl">
                            <Type className="w-5 h-5 text-[#1a1a1a]" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">Transcription Result</h3>
                            <p className="text-sm font-bold text-[#1a1a1a] opacity-80">{audioFile?.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={copyTranscription}
                            className="p-3 hover:bg-[#f5f5f5] border border-[#1a1a1a]/5 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <button 
                            onClick={() => { setTranscriptionResult(null); setTranscriptionStatus('idle'); }}
                            className="p-3 hover:bg-[#f5f5f5] border border-[#1a1a1a]/5 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100"
                          >
                            New Transcription
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-[#f9f9f9] rounded-3xl p-8 overflow-y-auto max-h-[500px] border border-[#1a1a1a]/5">
                        <div className="text-lg leading-relaxed text-[#1a1a1a]/80 whitespace-pre-wrap font-serif italic">
                          {transcriptionResult}
                        </div>
                      </div>
                    </div>
                  )}

                  {transcriptionStatus === 'error' && (
                    <div className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100 text-red-600 flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 shrink-0" />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest mb-1">AI Service Error</p>
                        <p className="text-sm opacity-80 leading-relaxed font-mono">{transcribeError}</p>
                        <button onClick={transcribeAudio} className="mt-4 text-xs font-bold underline hover:no-underline uppercase tracking-[0.2em]">Retry Operation</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-[#1a1a1a]/5 pt-8 gap-6 pb-12">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono opacity-40 uppercase tracking-[0.2em] bg-white px-5 py-2.5 rounded-full border border-[#1a1a1a]/5 shadow-sm">
              <Info className="w-3 h-3" />
              Direct Media Pipeline
            </div>
            {activeTab === 'transcribe' && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-green-600 uppercase tracking-[0.2em] bg-green-50 px-5 py-2.5 rounded-full border border-green-100">
                AI ACTIVE
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono opacity-30 uppercase tracking-[0.3em] text-center md:text-right">
            {activeTab === 'compressor' ? 'FFMPEG.WASM ENGINE • LOCAL NODE' : 'GOOGLE GEMINI 1.5 FLASH • CLOUD NODE'}
          </div>
        </footer>
      </div>
    </div>
  );
}

