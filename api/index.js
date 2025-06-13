const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configuration
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Conversation history in memory (reset on function cold start)
let conversationHistory = [];

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.wav') || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        sarvam_api_configured: !!SARVAM_API_KEY && SARVAM_API_KEY !== 'your_sarvam_api_key_here',
        livekit_configured: !!LIVEKIT_API_KEY && LIVEKIT_API_KEY !== 'your_livekit_api_key',
        timestamp: new Date().toISOString()
    });
});

// Speech to Text endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Processing STT for file:', req.file.originalname);

        // Check if Sarvam API key is configured
        if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
            console.log('⚠️  Sarvam API key not configured, returning demo response');
            return res.json({
                transcript: 'Demo mode - Please configure your Sarvam API key for speech recognition',
                language_code: 'en-IN'
            });
        }

        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('language_code', req.body.language_code || 'unknown');
        formData.append('model', 'saarika:v2');

        const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
            headers: {
                ...formData.getHeaders(),
                'api-subscription-key': SARVAM_API_KEY,
            },
            timeout: 30000,
        });

        // Clean up uploaded file
        try {
            fs.unlinkSync(req.file.path);
        } catch (e) {
            console.warn('Could not delete temp file:', e.message);
        }

        const transcript = response.data.transcript || 'Could not understand audio';
        const languageCode = response.data.language_code || 'en-IN';

        console.log('STT Result:', transcript);
        res.json({
            transcript,
            language_code: languageCode
        });

    } catch (error) {
        console.error('Speech-to-text error:', error.response?.data || error.message);
        
        // Clean up file on error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }

        res.status(500).json({ 
            error: 'Failed to process speech',
            details: error.response?.data || error.message 
        });
    }
});

// Chat endpoint
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
            return res.json({
                response: 'Hello! This is a demo response. Please configure your Sarvam AI API key for full conversational capabilities.'
            });
        }

        // Add user message to conversation history
        conversationHistory.push({ role: 'user', content: message });

        // Keep conversation history manageable (last 10 exchanges)
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

        const systemPrompt = { 
            role: 'system', 
            content: 'You are a helpful, friendly, and conversational assistant. Keep responses concise and natural. Respond in a warm, human-like manner.' 
        };
        const messages = [systemPrompt, ...conversationHistory];

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
            timeout: 30000
        });

        let aiReply = 'Sorry, I could not generate a response.';
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            aiReply = response.data.choices[0].message.content;
        }

        conversationHistory.push({ role: 'assistant', content: aiReply });
        
        console.log('Chat Response:', aiReply);
        res.json({ response: aiReply });

    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.response?.data || error.message 
        });
    }
});

// Text to Speech endpoint
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
            const silentAudio = Buffer.alloc(1024);
            res.set({
                'Content-Type': 'audio/wav',
                'Content-Length': silentAudio.length
            });
            return res.send(silentAudio);
        }

        const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
            text: text,
            target_language_code: target_language_code || 'en-IN',
            speaker: speaker || 'vidya',
            enable_preprocessing: true
        }, {
            headers: {
                'api-subscription-key': SARVAM_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        let audioBase64 = null;
        if (response.data && response.data.audios && response.data.audios.length > 0) {
            audioBase64 = response.data.audios[0];
        } else if (response.data && response.data.audio) {
            audioBase64 = response.data.audio;
        }

        if (!audioBase64) {
            throw new Error('No audio data received from Sarvam AI');
        }

        const audioBuffer = Buffer.from(audioBase64, 'base64');
        console.log('Audio generated:', audioBuffer.length, 'bytes');
        
        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length
        });
        res.send(audioBuffer);

    } catch (error) {
        console.error('Text-to-speech error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to convert text to speech',
            details: error.response?.data || error.message 
        });
    }
});

// Token endpoint (demo mode)
app.post('/api/token', (req, res) => {
    console.log('🎫 Token request for demo mode');
    res.json({ token: 'demo-voice-agent-token-' + Date.now() });
});

// Reset conversation
app.post('/api/reset-conversation', (req, res) => {
    conversationHistory = [];
    res.json({ status: 'reset' });
});

// Export for Vercel
module.exports = app; 