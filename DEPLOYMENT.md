# 🚀 Deployment Guide

## 🏆 Recommended: Vercel (Easiest for Next.js)

### Step 1: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Project name: sarvamai-realtime-chat
# - Directory: ./
# - Framework: Next.js
```

### Step 2: Set Environment Variables in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add these variables:

```
SARVAM_API_KEY=your_sarvam_api_key_here
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_WS_URL=wss://your-app.vercel.app
PORT=3000
```

### Step 3: Redeploy
```bash
vercel --prod
```

---

## 🔥 Alternative: Railway (Full-Stack Friendly)

Railway is perfect for applications with WebSocket support:

### Step 1: Connect GitHub
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub
3. Click "Deploy from GitHub repo"
4. Select your `sarvamai-realtime-chat` repository

### Step 2: Configure Environment Variables
Add these in Railway dashboard:
```
SARVAM_API_KEY=your_sarvam_api_key_here
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_WS_URL=wss://your-app.railway.app
PORT=$PORT
```

### Step 3: Set Start Command
In Railway settings, set start command to:
```
npm start
```

---

## ⚡ Alternative: Render (Free Tier Available)

### Step 1: Create Web Service
1. Go to [Render](https://render.com)
2. Connect your GitHub repo
3. Choose "Web Service"

### Step 2: Configure Build & Start
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 18

### Step 3: Environment Variables
Add the same environment variables as above.

---

## 🐳 Docker Deployment (Any Platform)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SARVAM_API_KEY=${SARVAM_API_KEY}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
      - LIVEKIT_WS_URL=${LIVEKIT_WS_URL}
```

Deploy to:
- **DigitalOcean App Platform**
- **AWS ECS**
- **Google Cloud Run**
- **Azure Container Instances**

---

## 🔧 Environment Variables Needed

### Required
- `SARVAM_API_KEY` - Get from [Sarvam AI](https://www.sarvam.ai/)
- `PORT` - Usually set automatically by hosting platform

### Optional (for LiveKit features)
- `LIVEKIT_API_KEY` - For real-time features
- `LIVEKIT_API_SECRET` - For real-time features  
- `LIVEKIT_WS_URL` - WebSocket URL for your deployment

---

## 🎯 Quick Deploy Commands

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Railway
```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### Heroku
```bash
npm i -g heroku
heroku create your-app-name
git push heroku main
heroku config:set SARVAM_API_KEY=your_key_here
```

---

## 🔍 Post-Deployment Checklist

- [ ] App loads at your domain
- [ ] Microphone permissions work (HTTPS required)
- [ ] Speech-to-text functionality works
- [ ] AI chat responses are generated
- [ ] Text-to-speech audio plays
- [ ] No console errors
- [ ] WebSocket connections establish successfully

---

## 🚨 Common Issues & Fixes

### 1. Microphone Not Working
**Problem**: HTTP sites can't access microphone
**Solution**: Deploy with HTTPS (all recommended platforms provide this)

### 2. WebSocket Connection Failed
**Problem**: WSS not configured properly
**Solution**: Update `LIVEKIT_WS_URL` to use `wss://` with your domain

### 3. API Timeouts
**Problem**: Sarvam AI requests timing out
**Solution**: Check API key and network connectivity

### 4. CORS Errors
**Problem**: Frontend can't connect to backend
**Solution**: Update CORS settings in `index.js` for your domain

---

## 💡 Performance Tips

1. **Enable Caching**: Use CDN for static assets
2. **Compress Audio**: Optimize audio file sizes
3. **Connection Pooling**: For high-traffic deployments
4. **Load Balancing**: For multiple server instances

---

## 📞 Need Help?

- Check deployment logs in your hosting platform
- Test API endpoints with curl/Postman
- Verify environment variables are set correctly
- Ensure all dependencies are installed 