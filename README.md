# 🎤 Sarvam AI Voice Agent

A complete voice AI application built with **Sarvam AI** APIs, featuring real-time speech-to-text, AI chat, and text-to-speech capabilities with a beautiful React frontend.

## ✨ Features

- 🎤 **Voice Recording** - Click to record audio (max 5 seconds)
- 🗣️ **Speech-to-Text** - Auto language detection (8+ Indian languages + English)
- 🤖 **AI Chat** - Intelligent responses using Sarvam AI's `sarvam-m` model
- 🔊 **Text-to-Speech** - Human-like voice with Vidya speaker
- 💬 **Conversation History** - Real-time conversation display
- 🎨 **Beautiful UI** - Modern call interface with animations
- 🔄 **Error Handling** - Comprehensive error handling and user feedback

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd conversational-ai
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_WS_URL=ws://localhost:7880
PORT=3555
```

### 3. Get Your Sarvam AI API Key
1. Visit [Sarvam AI](https://www.sarvam.ai/)
2. Sign up for an account
3. Get your API key from the dashboard
4. Add it to your `.env` file

### 4. Run the Application
```bash
npm run dev
```

This will start:
- **Backend API** on http://localhost:3555
- **Frontend React App** on http://localhost:3556
- **Simplified Agent** in demo mode

### 5. Open Your Browser
Navigate to http://localhost:3556 and start talking to your AI assistant!

## 🔧 API Endpoints

### Backend (Port 3555)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check and configuration status |
| `/api/speech-to-text` | POST | Convert audio to text |
| `/api/chat` | POST | Get AI responses |
| `/api/text-to-speech` | POST | Convert text to audio |
| `/api/token` | POST | Generate LiveKit tokens |

### Example Usage

#### Speech-to-Text
```bash
curl -X POST http://localhost:3555/api/speech-to-text \
  -F "audio=@recording.wav" \
  -F "language_code=unknown"
```

#### Chat
```bash
curl -X POST http://localhost:3555/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

#### Text-to-Speech
```bash
curl -X POST http://localhost:3555/api/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "speaker": "vidya", "target_language_code": "en-IN"}'
```

## 🎯 Sarvam AI Integration

### Supported Languages
- **English** (en-IN)
- **Hindi** (hi-IN)
- **Bengali** (bn-IN)
- **Gujarati** (gu-IN)
- **Kannada** (kn-IN)
- **Malayalam** (ml-IN)
- **Marathi** (mr-IN)
- **Odia** (od-IN)
- **Punjabi** (pa-IN)
- **Tamil** (ta-IN)
- **Telugu** (te-IN)

### Voice Options
- **Vidya** - Female, natural voice (default)
- **Anushka** - Female, expressive voice
- **Arjun** - Male, clear voice

### Models Used
- **Speech-to-Text**: `saarika:v2` with auto language detection
- **Chat**: `sarvam-m` with conversation memory
- **Text-to-Speech**: Enhanced with preprocessing for natural speech

## 🛠️ Development

### Project Structure
```
conversational-ai/
├── index.js              # Backend Express server
├── agent.js              # Simplified LiveKit agent
├── start.js              # Concurrent startup script
├── test-api.js           # API testing script
├── package.json          # Backend dependencies
├── uploads/              # Temporary audio files
└── frontend/
    ├── src/
    │   ├── App.tsx       # Main React component
    │   └── App.css       # Styling
    └── package.json      # Frontend dependencies
```

### Available Scripts

```bash
# Start all services
npm run dev

# Start backend only
npm start

# Start frontend only
npm run frontend

# Start agent only
npm run agent

# Test APIs
node test-api.js
```

## 🔍 Troubleshooting

### Common Issues

#### 1. "Invalid file type" Error
**Problem**: Audio file format not supported by Sarvam AI
**Solution**: The app automatically handles this by using supported formats (WAV, MP3, WebM)

#### 2. "API key not configured" 
**Problem**: Missing or invalid Sarvam AI API key
**Solution**: 
- Check your `.env` file
- Ensure `SARVAM_API_KEY` is set correctly
- Verify your API key is active

#### 3. "Request timed out"
**Problem**: Network or API timeout
**Solution**: 
- Check your internet connection
- Verify Sarvam AI service status
- Try again after a moment

#### 4. Microphone Access Denied
**Problem**: Browser doesn't have microphone permissions
**Solution**: 
- Allow microphone access when prompted
- Check browser settings for microphone permissions
- Use HTTPS in production

### Debug Mode
Enable detailed logging by checking the browser console and backend logs:

```bash
# Backend logs
npm run dev

# Frontend logs
Open browser DevTools → Console
```

## 🌟 Demo Mode

The application works in demo mode even without a Sarvam AI API key:
- **Speech-to-Text**: Returns demo transcript
- **Chat**: Returns helpful demo responses
- **Text-to-Speech**: Returns silent audio

This allows you to test the interface before configuring your API key.

## 📱 Production Deployment

### Environment Setup
1. Set production environment variables
2. Use HTTPS for microphone access
3. Configure proper CORS settings
4. Set up LiveKit server for real-time features

### Performance Tips
- Use audio compression for faster uploads
- Implement request caching for repeated queries
- Add rate limiting for API protection
- Monitor API usage and costs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Sarvam AI** for providing excellent multilingual AI APIs
- **LiveKit** for real-time communication infrastructure
- **React** and **Express** for the application framework

---

**Need Help?** Check the console logs for detailed error messages and debugging information.

**API Documentation**: [Sarvam AI Docs](https://docs.sarvam.ai/)

**Live Demo**: http://localhost:3556 (after setup)
