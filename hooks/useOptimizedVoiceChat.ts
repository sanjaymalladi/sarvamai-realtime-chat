import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioChunk {
  chunk: string;
  sessionId: string;
  timestamp: number;
}

interface VoiceResponse {
  transcript: string;
  response: string;
  audio: string;
  fromCache?: boolean;
}

export function useOptimizedVoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>('');
  
  // Initialize WebSocket connection
  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket('ws://localhost:3557');
      
      wsRef.current.onopen = () => {
        console.log('🎵 Connected to optimized voice server');
        setIsConnected(true);
        sessionIdRef.current = Date.now().toString();
      };
      
      wsRef.current.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'chunk_received':
            // Immediate feedback - chunk received
            break;
            
          case 'transcript_ready':
            // Show transcript immediately when STT completes
            setTranscript(data.transcript);
            break;
            
          case 'response_complete':
            // Complete response with audio
            setResponse(data.response);
            setIsProcessing(false);
            
            // Play audio immediately
            if (data.audio) {
              playAudioResponse(data.audio);
            }
            
            if (data.fromCache) {
              console.log('⚡ Response served from cache');
            }
            break;
            
          case 'error':
            console.error('Voice processing error:', data.error);
            setIsProcessing(false);
            break;
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('🔌 Disconnected from voice server');
        setIsConnected(false);
      };
      
             wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
    }
  }, []);
  
  // Initialize audio context and recorder
  const initializeAudio = useCallback(async () => {
    try {
      // Use optimized audio settings for faster processing
      audioContextRef.current = new AudioContext({
        sampleRate: 16000, // Lower sample rate for faster processing
        latencyHint: 'interactive'
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1 // Mono for faster processing
        }
      });
      
      // Use optimized recorder settings
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000 // Lower bitrate for faster transfer
      });
      
             mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send audio chunks in real-time for processing
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
        // Send final signal to process complete audio
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio_complete',
            sessionId: sessionIdRef.current
          }));
        }
        
        // Clean up chunks
        audioChunksRef.current = [];
        sessionIdRef.current = Date.now().toString();
      };
      
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }, []);
  
  // Start recording with optimizations
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isConnected) return;
    
    setIsProcessing(true);
    setTranscript('');
    setResponse('');
    
    // Record in small chunks for real-time processing
    mediaRecorderRef.current.start(250); // 250ms chunks for real-time feel
    console.log('🎤 Started optimized recording');
  }, [isConnected]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    console.log('🛑 Stopped recording, processing...');
  }, []);
  
  // Play audio response with optimizations
  const playAudioResponse = useCallback(async (audioData: string) => {
    try {
      if (!audioContextRef.current) return;
      
      // Decode and play audio immediately
      const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      const decodedAudio = await audioContextRef.current.decodeAudioData(audioBuffer.buffer);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContextRef.current.destination);
      source.start();
      
    } catch (error) {
      console.error('Audio playback error:', error);
      // Fallback to HTML5 audio
      const audio = new Audio(`data:audio/wav;base64,${audioData}`);
      audio.play().catch(console.error);
    }
  }, []);
  
  // Initialize everything
  useEffect(() => {
    connect();
    initializeAudio();
    
    return () => {
      wsRef.current?.close();
      audioContextRef.current?.close();
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [connect, initializeAudio]);
  
  return {
    isConnected,
    isProcessing,
    transcript,
    response,
    startRecording,
    stopRecording,
    connect
  };
} 