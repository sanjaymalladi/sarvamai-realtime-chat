export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

  res.status(200).json({
    success: true,
    message: 'Sarvam AI Voice Assistant API is running!',
    timestamp: new Date().toISOString(),
    configuration: {
      sarvam_api_configured: !!SARVAM_API_KEY && SARVAM_API_KEY !== 'your_sarvam_api_key_here',
      supported_languages: ['en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN'],
      available_voices: ['vidya', 'anushka', 'arjun']
    }
  });
} 