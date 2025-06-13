const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

    if (!SARVAM_API_KEY || SARVAM_API_KEY === 'your_sarvam_api_key_here') {
      const demoResponses = {
        'hello': 'Hello! I\'m your AI assistant. Configure your Sarvam API key for full functionality.',
        'hi': 'Hi there! I\'m running in demo mode. Add your API key to unlock all features.',
        'how are you': 'I\'m doing great! This is a demo response. Configure your Sarvam AI API key for intelligent conversations.',
        'default': `Thanks for your message: "${message}". I'm running in demo mode. Please configure your Sarvam AI API key for actual AI responses.`
      };
      
      const response = demoResponses[message.toLowerCase()] || demoResponses['default'];
      
      return res.status(200).json({
        success: true,
        response: response,
        demo_mode: true
      });
    }

    const response = await axios.post('https://api.sarvam.ai/chat/completions', {
      model: 'sarvam-m',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Provide clear, concise, and friendly responses.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      timeout: 30000,
    });

    const aiResponse = response.data.choices?.[0]?.message?.content || 'I apologize, but I could not generate a response.';

    res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Chat error:', error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid API key. Please check your Sarvam AI API key.' });
    }

    res.status(500).json({
      error: 'Chat failed',
      message: error.message,
      demo_response: `I understand you said: "${req.body.message}". This is a demo response - please configure your API key for AI chat.`
    });
  }
} 