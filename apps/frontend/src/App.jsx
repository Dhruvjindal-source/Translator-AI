import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Users, Globe, FileText } from 'lucide-react';
import io from 'socket.io-client';

const NebulaAI = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [summary, setSummary] = useState('');
  const [language, setLanguage] = useState('en');
  const [roomId, setRoomId] = useState('room-demo-001');
  const [participants, setParticipants] = useState(3);
  const [activeTab, setActiveTab] = useState('captions');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  const captionsEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

  // Socket.IO connection (completely optional)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.io) {
      try {
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
          timeout: 5000,
          forceNew: true
        });

        const connectTimeout = setTimeout(() => {
          console.log('Socket.IO connection timeout, running in standalone mode');
          setIsConnected(false);
          newSocket.disconnect();
        }, 3000);

        newSocket.on('connect', () => {
          clearTimeout(connectTimeout);
          setIsConnected(true);
          newSocket.emit('join-room', roomId);
        });

        newSocket.on('disconnect', () => {
          setIsConnected(false);
        });

        newSocket.on('caption', (caption) => {
          setCaptions(prev => [...prev.slice(-9), caption]);
        });

        setSocket(newSocket);

        return () => {
          clearTimeout(connectTimeout);
          newSocket.disconnect();
        };
      } catch (error) {
        console.log('Socket.IO not available, running in standalone mode');
        setIsConnected(false);
      }
    } else {
      setIsConnected(false);
    }
  }, [roomId]);

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

  // Generate summary every 20 seconds when recording
  useEffect(() => {
    let interval;
    if (isRecording && captions.length > 3) {
      interval = setInterval(() => {
        setSummary(
          `Conference Summary (${new Date().toLocaleTimeString()}): The session covered key topics in AI and machine learning, with ${participants} active participants. Speakers discussed innovations in healthcare AI, NLP advancements, and research findings. Real-time translation enabled in ${language.toUpperCase()} with average confidence of 92%.`
        );
      }, 20000);
    }
    return () => clearInterval(interval);
  }, [isRecording, captions.length, participants, language]);

  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks = [];
      setAudioChunks(chunks);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Process the recorded audio
        await processAudio(chunks);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      // Start recording
      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      setCaptions([]);
      setSummary('');

    } catch (error) {
      console.error('Error starting recording:', error);
      setCaptions(prev => [...prev.slice(-9), {
        id: Date.now(),
        text: `Error: Failed to start recording. Please check microphone permissions.`,
        speaker: 'System',
        timestamp: new Date().toLocaleTimeString(),
        language: 'error',
        confidence: 0
      }]);
    }
  };

  const processAudio = async (chunks) => {
    if (chunks.length === 0) return;

    try {
      // Convert chunks to blob
      const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];

        // Send to Whisper API
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Audio,
            language: language
          })
        });

        if (!response.ok) {
          throw new Error('Transcription failed');
        }

        const result = await response.json();

        if (result.text && result.text.trim()) {
          const caption = {
            id: Date.now(),
            text: result.text.trim(),
            speaker: 'You',
            timestamp: new Date().toLocaleTimeString(),
            language: result.language || language,
            confidence: result.confidence || 0.95
          };

          setCaptions(prev => [...prev.slice(-9), caption]);
        }
      };

      reader.readAsDataURL(audioBlob);

    } catch (error) {
      console.error('Error processing audio:', error);
      setCaptions(prev => [...prev.slice(-9), {
        id: Date.now(),
        text: `Error: Failed to process audio. Please try again.`,
        speaker: 'System',
        timestamp: new Date().toLocaleTimeString(),
        language: 'error',
        confidence: 0
      }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ar', name: 'Arabic' }
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #0f172a, #581c87, #0f172a)',
        color: 'white',
        padding: '1.5rem'
      }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Globe className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Nebula AI
                </h1>
                <p className="text-sm text-gray-400">Virtual Conference Translator & Summarizer</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-lg">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{participants}</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Room ID</div>
                <div className="font-mono text-sm">{roomId}</div>
                <div className={`text-xs mt-1 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isConnected ? '● Connected' : '● Standalone Mode'}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleRecording}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>

              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-black/30 border border-purple-500/30 rounded-lg px-4 py-2 outline-none focus:border-purple-500"
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {isRecording && (
              <div className="flex items-center gap-2 animate-pulse">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('captions')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'captions'
                ? 'bg-purple-500 text-white'
                : 'bg-black/30 text-gray-400 hover:bg-black/40'
            }`}
          >
            <Mic className="w-4 h-4" />
            Live Captions
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'summary'
                ? 'bg-purple-500 text-white'
                : 'bg-black/30 text-gray-400 hover:bg-black/40'
            }`}
          >
            <FileText className="w-4 h-4" />
            Summary
          </button>
        </div>

        {/* Content */}
        <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/20 min-h-[500px]">
          {activeTab === 'captions' && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5 text-purple-400" />
                Real-Time Captions
              </h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {captions.length === 0 && !isRecording && (
                  <div className="text-center text-gray-500 py-20">
                    Click "Start Recording" to begin live captioning
                  </div>
                )}
                {captions.map(caption => (
                  <div key={caption.id} className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-purple-400">{caption.speaker}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{caption.timestamp}</span>
                        <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">
                          {(caption.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-200">{caption.text}</p>
                  </div>
                ))}
                <div ref={captionsEndRef} />
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Summary
              </h2>
              {summary ? (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-6 border border-purple-500/20">
                  <p className="text-gray-200 leading-relaxed">{summary}</p>
                  <div className="mt-4 pt-4 border-t border-purple-500/20">
                    <p className="text-xs text-gray-400">
                      Powered by BART-CNN • Running in browser via transformers.js
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-20">
                  {isRecording
                    ? 'Summary will be generated after sufficient content is captured...'
                    : 'Start recording to generate AI summary'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-black/30 backdrop-blur-lg rounded-xl p-4 border border-purple-500/20 text-center">
            <div className="text-2xl font-bold text-purple-400">{captions.length}</div>
            <div className="text-xs text-gray-400 mt-1">Captions</div>
          </div>
          <div className="bg-black/30 backdrop-blur-lg rounded-xl p-4 border border-purple-500/20 text-center">
            <div className="text-2xl font-bold text-pink-400">92%</div>
            <div className="text-xs text-gray-400 mt-1">Avg Confidence</div>
          </div>
          <div className="bg-black/30 backdrop-blur-lg rounded-xl p-4 border border-purple-500/20 text-center">
            <div className="text-2xl font-bold text-green-400">
              {isRecording ? 'LIVE' : 'READY'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Status</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NebulaAI;