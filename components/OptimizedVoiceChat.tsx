'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface OptimizedVoiceChatProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onResponseUpdate?: (response: string) => void;
}

export default function OptimizedVoiceChat({ 
  onTranscriptUpdate, 
  onResponseUpdate 
}: OptimizedVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>('');
  
  // Connect to optimized WebSocket server
  const connectToOptimizedServer = useCallback(() => {
    try {
      wsRef.current = new WebSocket('ws://localhost:3557');
      
      wsRef.current.onopen = () => {
        console.log('⚡ Connected to optimized voice server');
        setIsConnected(true);
        sessionIdRef.current = Date.now().toString();
      };
      
      wsRef.current.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'chunk_received':
            setProcessingStage('Processing audio...');
            break;
            
          case 'transcript_ready':
            setTranscript(data.transcript);
            onTranscriptUpdate?.(data.transcript);
            setProcessingStage('Generating response...');
            break;
            
          case 'response_complete':
            setResponse(data.response);
            onResponseUpdate?.(data.response);
            setIsProcessing(false);
            setProcessingStage('');
            
            // Play audio response immediately
            if (data.audio) {
              playAudioResponse(data.audio);
            }
            
            if (data.fromCache) {
              console.log('⚡ Lightning fast - served from cache!');
            }
            break;
            
          case 'error':
            console.error('Voice processing error:', data.error);
            setIsProcessing(false);
            setProcessingStage('Error occurred');
            break;
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('🔌 Disconnected from optimized server');
        setIsConnected(false);
      };
      
      wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }, [onTranscriptUpdate, onResponseUpdate]);
  
  // Initialize optimized audio recording
  const initializeOptimizedAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimized for faster processing
          channelCount: 1     // Mono for speed
        }
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000 // Lower bitrate for faster transfer
      });
      
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Stream audio chunks in real-time
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Audio = reader.result?.toString().split(',')[1];
              if (base64Audio) {
                wsRef.current?.send(JSON.stringify({
                  type: 'audio_chunk',
                  chunk: base64Audio,
                  sessionId: sessionIdRef.current
                }));
              }
            };
            reader.readAsDataURL(event.data);
          }
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio_complete',
            sessionId: sessionIdRef.current
          }));
        }
        audioChunksRef.current = [];
        setIsRecording(false);
      };
      
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }, []);
  
  // Start optimized recording
  const startOptimizedRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isConnected) return;
    
    setIsRecording(true);
    setIsProcessing(true);
    setTranscript('');
    setResponse('');
    setProcessingStage('Listening...');
    
    // Record in 200ms chunks for ultra-responsive feel
    mediaRecorderRef.current.start(200);
    sessionIdRef.current = Date.now().toString();
  }, [isConnected]);
  
  // Stop recording
  const stopOptimizedRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setProcessingStage('Finalizing...');
  }, []);
  
  // Play audio with Web Audio API for minimal latency
  const playAudioResponse = useCallback(async (audioData: string) => {
    try {
      const audioContext = new AudioContext();
      const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer.buffer);
      
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.start();
      
    } catch (error) {
      // Fallback to HTML5 audio
      const audio = new Audio(`data:audio/wav;base64,${audioData}`);
      audio.play().catch(console.error);
    }
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    connectToOptimizedServer();
    initializeOptimizedAudio();
    
    return () => {
      wsRef.current?.close();
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [connectToOptimizedServer, initializeOptimizedAudio]);
  
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* Connection Status */}
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
        {isConnected ? '⚡ Optimized Server Connected' : '❌ Server Disconnected'}
      </div>
      
      {/* Voice Interface */}
      <div className="flex flex-col items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onMouseDown={startOptimizedRecording}
          onMouseUp={stopOptimizedRecording}
          onTouchStart={startOptimizedRecording}
          onTouchEnd={stopOptimizedRecording}
          disabled={!isConnected}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${
            isRecording 
              ? 'bg-red-500 text-white shadow-lg shadow-red-300 animate-pulse' 
              : isConnected
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isRecording ? '🛑' : '🎤'}
        </motion.button>
        
        <p className="text-sm text-gray-600">
          {isRecording ? 'Release to send' : 'Hold to speak'}
        </p>
      </div>
      
      {/* Processing Status */}
      {processingStage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-blue-600"
        >
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          {processingStage}
        </motion.div>
      )}
      
      {/* Transcript */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-100 rounded-lg p-3 max-w-md"
        >
          <p className="text-sm text-gray-600 mb-1">You said:</p>
          <p className="text-gray-800">{transcript}</p>
        </motion.div>
      )}
      
      {/* Response */}
      {response && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 rounded-lg p-3 max-w-md"
        >
          <p className="text-sm text-blue-600 mb-1">AI Response:</p>
          <p className="text-blue-800">{response}</p>
        </motion.div>
      )}
      
      {/* Performance Metrics */}
      <div className="text-xs text-gray-500 text-center">
        🚀 Optimized for speed: Real-time audio streaming + Response caching + Parallel processing
      </div>
    </div>
  );
} 