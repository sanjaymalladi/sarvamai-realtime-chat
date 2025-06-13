const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const { AccessToken } = require('livekit-server-sdk');
const multer = require('multer');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// WebSocket server for real-time audio processing
const wsServer = new WebSocket.Server({ port: 3557 });
console.log('🎵 WebSocket server running on port 3557');

// Audio chunk processing queue
const audioQueue = new Map();
const responseCache = new Map();

// Configure multer for file uploads with proper audio handling
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.wav') || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'), false);
    }
  }
});

// Memory storage for audio chunks (instead of file I/O)
const audioChunks = new Map();

// WebSocket connection handler for real-time processing
wsServer.on('connection', (ws) => {
  console.log('🔗 WebSocket client connected');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'audio_chunk') {
        // Process audio chunk immediately without file I/O
        await processAudioChunkRealtime(ws, message.chunk, message.sessionId);
      } else if (message.type === 'audio_complete') {
        // Process complete audio for final STT
        await processCompleteAudio(ws, message.sessionId);
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Real-time audio chunk processing
async function processAudioChunkRealtime(ws, audioChunk, sessionId) {
  if (!audioChunks.has(sessionId)) {
    audioChunks.set(sessionId, []);
  }
  
  audioChunks.get(sessionId).push(audioChunk);
  
  // Send immediate acknowledgment
  ws.send(JSON.stringify({ 
    type: 'chunk_received', 
    sessionId,
    status: 'processing' 
  }));
}

// Process complete audio with optimizations
async function processCompleteAudio(ws, sessionId) {
  try {
    const chunks = audioChunks.get(sessionId) || [];
    if (chunks.length === 0) return;
    
    // Combine audio chunks in memory (no file I/O)
    const combinedAudio = Buffer.concat(chunks.map(chunk => Buffer.from(chunk, 'base64')));
    
    // Check response cache first
    const audioHash = require('crypto').createHash('md5').update(combinedAudio).digest('hex');
    if (responseCache.has(audioHash)) {
      const cached = responseCache.get(audioHash);
      ws.send(JSON.stringify({
        type: 'response_complete',
        transcript: cached.transcript,
        response: cached.response,
        audio: cached.audio,
        fromCache: true
      }));
      return;
    }
    
    // Start STT and prepare Chat concurrently
    const sttPromise = processSTTOptimized(combinedAudio);
    
    sttPromise.then(async (sttResult) => {
      // Send STT result immediately
      ws.send(JSON.stringify({
        type: 'transcript_ready',
        transcript: sttResult.transcript,
        language: sttResult.language_code
      }));
      
      // Process chat and TTS in parallel
      const [chatResult, ttsResult] = await Promise.all([
        processChatOptimized(sttResult.transcript),
        // Pre-generate TTS for common responses
        sttResult.transcript.length < 50 ? preGenerateTTS(sttResult.transcript) : null
      ]);
      
      // Generate TTS if not pre-generated
      const finalTTS = ttsResult || await processTTSOptimized(chatResult.response, sttResult.language_code);
      
      // Cache the complete response
      responseCache.set(audioHash, {
        transcript: sttResult.transcript,
        response: chatResult.response,
        audio: finalTTS
      });
      
      // Send final response
      ws.send(JSON.stringify({
        type: 'response_complete',
        transcript: sttResult.transcript,
        response: chatResult.response,
        audio: finalTTS
      }));
    });
    
    // Clean up chunks
    audioChunks.delete(sessionId);
    
  } catch (error) {
    console.error('Complete audio processing error:', error);
    ws.send(JSON.stringify({ type: 'error', error: error.message }));
  }
}

// Optimized STT processing
async function processSTTOptimized(audioBuffer) {
  if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
    return { transcript: 'Demo mode - add Sarvam API key', language_code: 'en-IN' };
  }
  
  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: 'audio.wav',
    contentType: 'audio/wav'
  });
  formData.append('language_code', 'unknown');
  formData.append('model', 'saarika:v2');
  
  const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
    headers: {
      ...formData.getHeaders(),
      'api-subscription-key': SARVAM_API_KEY,
    },
    timeout: 15000, // Reduced timeout
  });
  
  return {
    transcript: response.data.transcript || 'Could not understand audio',
    language_code: response.data.language_code || 'en-IN'
  };
}

// Optimized Chat processing with smart caching
async function processChatOptimized(message) {
  if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
    return { response: 'Demo response - configure Sarvam API key for full functionality' };
  }
  
  // Extended common queries for instant responses
  const commonResponses = {
    'hello': 'Hello! How can I help you today?',
    'hi': 'Hi there! What can I do for you?',
    'hey': 'Hey! What can I do for you?',
    'good morning': 'Good morning! How can I assist you today?',
    'good afternoon': 'Good afternoon! What can I help you with?',
    'good evening': 'Good evening! How may I help you?',
    'thank you': "You're welcome! Is there anything else I can help with?",
    'thanks': "You're welcome! Let me know if you need anything else.",
    'bye': 'Goodbye! Have a great day!',
    'goodbye': 'Goodbye! Take care!',
    'how are you': "I'm doing well, thank you for asking! How can I help you?",
    'what is your name': "I'm your AI assistant! How can I help you today?",
    'help': 'I\'m here to help! What would you like to know?',
    'yes': 'Great! How can I assist you further?',
    'no': 'No problem! Is there anything else I can help with?',
    'ok': 'Perfect! Let me know if you need anything else.',
    'okay': 'Sounds good! What else can I help you with?'
  };
  
  const lowerMessage = message.toLowerCase().trim();
  
  // Check exact matches first
  if (commonResponses[lowerMessage]) {
    console.log('⚡ Instant response for common query');
    return { response: commonResponses[lowerMessage] };
  }
  
  // Check for partial matches for very short queries
  if (lowerMessage.length <= 3) {
    for (const [key, value] of Object.entries(commonResponses)) {
      if (key.includes(lowerMessage) || lowerMessage.includes(key)) {
        console.log('⚡ Instant response for short query');
        return { response: value };
      }
    }
  }
  
  // Build conversation with optimized history
  const messages = [
    { 
      role: 'system', 
      content: 'You are a helpful, friendly assistant. Keep responses very concise (1-2 sentences max), natural, and conversational. Respond quickly and efficiently.' 
    },
    { role: 'user', content: message }
  ];
  
  const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
    messages,
    model: 'sarvam-m',
    max_tokens: 80, // Even more reduced for faster responses
    temperature: 0.6, // Slightly lower for more consistent responses
    stream: false
  }, {
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 12000 // More aggressive timeout
  });
  
  const aiReply = response.data?.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
  return { response: aiReply };
}

// Optimized TTS processing with advanced caching
async function processTTSOptimized(text, languageCode = 'en-IN') {
  if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
    return Buffer.alloc(1024); // Silent audio
  }
  
  // Check pre-generated common phrases first
  const lowerText = text.toLowerCase().trim();
  if (COMMON_PHRASES_TTS.has(lowerText)) {
    console.log('⚡ Using pre-generated TTS for common phrase');
    return COMMON_PHRASES_TTS.get(lowerText);
  }
  
  // Check TTS cache
  const cacheKey = `${text}_${languageCode}`;
  if (TTS_CACHE.has(cacheKey)) {
    console.log('⚡ TTS served from cache');
    return TTS_CACHE.get(cacheKey);
  }
  
  // Check if already processing to prevent duplicates
  if (PROCESSING_QUEUE.has(cacheKey)) {
    console.log('⏳ TTS already processing, waiting...');
    return await PROCESSING_QUEUE.get(cacheKey);
  }
  
  // Create processing promise
  const processingPromise = (async () => {
    try {
      const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
        text: text,
        target_language_code: languageCode,
        speaker: 'vidya',
        enable_preprocessing: true,
        pitch: 0.0,
        pace: 1.25, // Faster pace for quicker responses
        loudness: 1.0
      }, {
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 12000 // Even more aggressive timeout
      });
      
      const audioBase64 = response.data?.audios?.[0] || response.data?.audio;
      const audioBuffer = audioBase64 ? Buffer.from(audioBase64, 'base64') : Buffer.alloc(1024);
      
      // Cache the result
      TTS_CACHE.set(cacheKey, audioBuffer);
      
      // Limit cache size (keep last 100 entries)
      if (TTS_CACHE.size > 100) {
        const firstKey = TTS_CACHE.keys().next().value;
        TTS_CACHE.delete(firstKey);
      }
      
      return audioBuffer;
    } finally {
      // Clean up processing queue
      PROCESSING_QUEUE.delete(cacheKey);
    }
  })();
  
  // Add to processing queue
  PROCESSING_QUEUE.set(cacheKey, processingPromise);
  
  return await processingPromise;
}

// Pre-generate TTS for common phrases
async function preGenerateTTS(query) {
  // This could be expanded with more common responses
  return null; // For now, generate on demand
}

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'your_sarvam_api_key_here';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'your_livekit_api_key';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'your_livekit_api_secret';

// Store conversation history in memory (per session, for demo)
let conversationHistory = [];

// Advanced optimization features
const TTS_CACHE = new Map(); // Cache TTS responses
const COMMON_PHRASES_TTS = new Map(); // Pre-generated common responses
const PROCESSING_QUEUE = new Map(); // Prevent duplicate processing

// Pre-generate TTS for common phrases on startup
async function preGenerateCommonTTS() {
  const commonPhrases = [
    'Hello! How can I help you today?',
    'Hi there! What can I do for you?',
    'Thank you for using our service.',
    "You're welcome! Is there anything else I can help with?",
    'I apologize, but I did not understand that.',
    'Could you please repeat that?',
    'Let me help you with that.',
    'Is there anything else you need?'
  ];
  
  console.log('🔥 Pre-generating TTS for common phrases...');
  
  for (const phrase of commonPhrases) {
    try {
      if (SARVAM_API_KEY && SARVAM_API_KEY !== 'your_sarvam_api_key_here') {
        const ttsAudio = await processTTSOptimized(phrase);
        COMMON_PHRASES_TTS.set(phrase.toLowerCase(), ttsAudio);
      }
    } catch (error) {
      console.error(`Failed to pre-generate TTS for: "${phrase}"`, error.message);
    }
  }
  
  console.log(`✅ Pre-generated TTS for ${COMMON_PHRASES_TTS.size} common phrases`);
}

// Initialize common TTS cache
if (SARVAM_API_KEY && SARVAM_API_KEY !== 'your_sarvam_api_key_here') {
  setTimeout(preGenerateCommonTTS, 2000); // Give server time to start
}

// Helper: Save base64 audio to temp file
function saveBase64AudioToFile(base64Audio, ext = '.wav') {
    const matches = base64Audio.match(/^data:audio\/(\w+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 audio');
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = path.join(__dirname, `temp_${uuidv4()}${ext}`);
    fs.writeFileSync(filename, buffer);
    return filename;
}

// Speech to Text (auto language detection) - FIXED ENDPOINT
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Processing audio file:', req.file.filename, 'Original:', req.file.originalname, 'MIME:', req.file.mimetype);
        
        // Check if Sarvam API key is configured
        if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
            console.log('⚠️  Sarvam API key not configured, returning demo response');
            fs.unlinkSync(req.file.path); // Clean up
            return res.json({ transcript: 'Hello, this is a demo response since Sarvam API key is not configured.' });
        }
        
        // Create form data with proper content type
        const formData = new FormData();
        
        // Always use WAV format for Sarvam AI compatibility
        const filename = 'audio.wav';
        
        // Read the file and append with correct content type
        const fileStream = fs.createReadStream(req.file.path);
        formData.append('file', fileStream, {
            filename: filename,
            contentType: 'audio/wav'
        });
        
        // Add other required parameters as per Sarvam AI docs
        const languageCode = req.body.language_code || 'unknown';
        formData.append('language_code', languageCode);
        formData.append('model', 'saarika:v2');

        console.log('Sending to Sarvam AI STT with filename:', filename, 'content-type: audio/wav', 'language:', languageCode);

        const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
            headers: {
                ...formData.getHeaders(),
                'api-subscription-key': SARVAM_API_KEY,
            },
            maxBodyLength: Infinity,
            timeout: 30000, // 30 second timeout
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        console.log('STT Response:', response.data);
        
        // Extract transcript and language from response
        const transcript = response.data.transcript || response.data.text || 'Could not understand audio';
        const detectedLanguage = response.data.language_code || req.body.language_code || 'en-IN';
        
        res.json({ 
            transcript: transcript,
            language_code: detectedLanguage
        });
        
    } catch (error) {
        console.error('Speech-to-text error:', error.response?.data || error.message);
        
        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        // Return more specific error messages
        let errorMessage = 'Failed to convert speech to text';
        if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.response?.data || error.message 
        });
    }
});

// Chat Completion (conversational) - FIXED ENDPOINT
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        console.log('Processing chat message:', message);
        
        // Check if Sarvam API key is configured
        if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
            console.log('⚠️  Sarvam API key not configured, returning demo response');
            const demoResponses = [
                "I'm a demo AI assistant! To enable full functionality, please add your Sarvam API key.",
                "Hello! This is a demo response. Configure your Sarvam API key for real AI conversations.",
                "I'd love to help you! Please set up your Sarvam API key to unlock my full potential.",
                "This is a demo mode. Add your Sarvam API key to chat with the real AI assistant!"
            ];
            const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
            return res.json({ response: randomResponse });
        }
        
        // Clean and validate conversation history to prevent alternation errors
        const cleanHistory = [];
        let lastRole = null;
        
        // Filter out consecutive messages from the same role
        for (const msg of conversationHistory) {
            if (msg.role !== lastRole && msg.content && msg.content.trim()) {
                cleanHistory.push(msg);
                lastRole = msg.role;
            }
        }
        
        // Add user message to history (ensure it doesn't duplicate)
        if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].role !== 'user' || 
            cleanHistory[cleanHistory.length - 1].content !== message) {
            cleanHistory.push({ role: 'user', content: message });
        }
        
        // Update global history with cleaned version
        conversationHistory = cleanHistory;
        
        // Always start with a system prompt for context
        const systemPrompt = { 
            role: 'system', 
            content: 'You are a helpful, friendly, and conversational assistant. Keep responses concise and natural. Respond in a warm, human-like manner. Do not use emojis in your responses.' 
        };
        const messages = [systemPrompt, ...conversationHistory.slice(-10)]; // Keep last 10 messages
        
        console.log('Conversation messages being sent:', messages.map(m => `${m.role}: ${m.content?.substring(0, 50)}...`));
        
        console.log('Sending to Sarvam AI Chat API...');
        
        const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
            messages,
            model: 'sarvam-m',
            max_tokens: 150,
            temperature: 0.7,
            stream: false
        }, {
            headers: {
                'api-subscription-key': SARVAM_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log('Raw Sarvam AI response:', JSON.stringify(response.data, null, 2));
        
        // Extract AI reply from response
        let aiReply = 'Sorry, I could not generate a response.';
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            aiReply = response.data.choices[0].message.content;
        } else if (response.data && response.data.response) {
            aiReply = response.data.response;
        }
        
        // Add assistant reply to history
        conversationHistory.push({ role: 'assistant', content: aiReply });
        
        console.log('Chat Response:', aiReply);
        res.json({ response: aiReply });
        
    } catch (error) {
        console.error('Chat completion error:', error.response?.data || error.message);
        
        // Check if it's an alternation error and reset conversation if needed
        const errorMsg = error.response?.data?.error?.message || error.message || '';
        if (errorMsg.includes('alternate') || errorMsg.includes('First message must be from user')) {
            console.log('🔄 Resetting conversation due to alternation error');
            conversationHistory = [];
            
            // Try again with fresh conversation
            try {
                conversationHistory.push({ role: 'user', content: req.body.message });
                const systemPrompt = { 
                    role: 'system', 
                    content: 'You are a helpful, friendly, and conversational assistant. Keep responses concise and natural. Respond in a warm, human-like manner. Do not use emojis in your responses.' 
                };
                const messages = [systemPrompt, ...conversationHistory];
                
                const retryResponse = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
                    messages,
                    model: 'sarvam-m',
                    max_tokens: 150,
                    temperature: 0.7,
                    stream: false
                }, {
                    headers: {
                        'api-subscription-key': SARVAM_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                
                let aiReply = 'Sorry, I could not generate a response.';
                if (retryResponse.data && retryResponse.data.choices && retryResponse.data.choices.length > 0) {
                    aiReply = retryResponse.data.choices[0].message.content;
                }
                
                conversationHistory.push({ role: 'assistant', content: aiReply });
                console.log('✅ Retry successful after conversation reset');
                return res.json({ response: aiReply });
                
            } catch (retryError) {
                console.error('Retry also failed:', retryError.message);
            }
        }
        
        // Return more specific error messages
        let errorMessage = 'Failed to get AI response';
        if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.response?.data || error.message 
        });
    }
});

// Text to Speech (more human-like) - FIXED ENDPOINT
app.post('/api/text-to-speech', async (req, res) => {
    try {
        const { text, target_language_code, speaker } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        console.log('Processing TTS for text:', text.substring(0, 50) + '...');
        
        // Check if Sarvam API key is configured
        if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
            console.log('⚠️  Sarvam API key not configured, returning silence');
            // Return a small silent audio file
            const silentAudio = Buffer.alloc(1024); // Small silent buffer
            res.set({
                'Content-Type': 'audio/wav',
                'Content-Length': silentAudio.length
            });
            return res.send(silentAudio);
        }
        
        console.log('Sending to Sarvam AI TTS API...');
        
        const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
            text: text,
            target_language_code: target_language_code || 'en-IN',
            speaker: speaker || 'vidya',
            enable_preprocessing: true,
            pitch: 0.0,
            pace: 1.0,
            loudness: 1.0
        }, {
            headers: {
                'api-subscription-key': SARVAM_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log('TTS Response received, processing audio...');
        
        // Extract audio from response
        let audioBase64 = null;
        if (response.data && response.data.audios && response.data.audios.length > 0) {
            audioBase64 = response.data.audios[0];
        } else if (response.data && response.data.audio) {
            audioBase64 = response.data.audio;
        }
        
        if (!audioBase64) {
            throw new Error('No audio data received from Sarvam AI');
        }
        
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        console.log('Audio generated:', audioBuffer.length, 'bytes');
        
        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length
        });
        res.send(audioBuffer);
        
    } catch (error) {
        console.error('Text-to-speech error:', error.response?.data || error.message);
        
        // Return more specific error messages
        let errorMessage = 'Failed to convert text to speech';
        if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.response?.data || error.message 
        });
    }
});

// Reset conversation (optional endpoint)
app.post('/api/reset-conversation', (req, res) => {
    conversationHistory = [];
    res.json({ status: 'reset' });
});

// Generate LiveKit token for frontend
app.post('/api/token', (req, res) => {
    const { identity, room } = req.body;
    
    console.log('🎫 Token request for identity:', identity, 'room:', room);
    
    // For this demo, we'll always return a mock token since we're not using LiveKit features
    // The frontend just needs a token to proceed to the connected state
    console.log('Returning demo token for voice agent functionality');
    res.json({ token: 'demo-voice-agent-token-' + Date.now() });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        sarvam_api_configured: !!SARVAM_API_KEY && SARVAM_API_KEY !== 'your_sarvam_api_key_here',
        livekit_configured: !!LIVEKIT_API_KEY && LIVEKIT_API_KEY !== 'your_livekit_api_key'
    });
});

const PORT = process.env.PORT || 3555;
app.listen(PORT, () => {
    console.log(`🚀 Sarvam AI TTS server running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /api/speech-to-text - Convert speech to text`);
    console.log(`   POST /api/chat - Get AI response`);
    console.log(`   POST /api/text-to-speech - Convert text to speech`);
    console.log(`   POST /api/token - Generate LiveKit token`);
    console.log(`   GET /api/health - Health check`);
    console.log(`\n⚠️  Note: Add your SARVAM_API_KEY to environment variables for full functionality`);
}); 