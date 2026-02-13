# Ceptra AI

**AI platform — code, images, docs, slides, PDFs, spreadsheets, tests, research.**

## Deploy to Vercel (5 minutes)

### Step 1: Get an OpenRouter API key
1. Go to https://openrouter.ai
2. Sign up (free)
3. Go to https://openrouter.ai/keys
4. Click "Create Key"
5. Copy the key (starts with `sk-or-v1-...`)

### Step 2: Push to GitHub
```bash
cd ceptra-ai
git init
git add .
git commit -m "Initial commit"
```
Then create a repo on https://github.com/new and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/ceptra-ai.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Vercel
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Import Project"
4. Select your `ceptra-ai` repo
5. In "Environment Variables", add:
   - `OPENROUTER_API_KEY` = your key from Step 1
   - `NEXT_PUBLIC_APP_URL` = (leave blank, Vercel fills this)
6. Click "Deploy"
7. Wait ~2 minutes
8. Your app is live at `https://ceptra-ai-xxx.vercel.app`

### Step 4: Custom domain (optional)
1. Buy `ceptra.ai` or similar on Namecheap/GoDaddy (~$12/yr)
2. In Vercel → Settings → Domains → Add your domain
3. Update DNS as Vercel instructs

## Run Locally

```bash
# With Ollama (free, private)
ollama pull qwen2.5:7b
cp .env.example .env.local
# Edit .env.local: uncomment OLLAMA_URL line
npm install && npm run dev

# With cloud API (no Ollama needed)
cp .env.example .env.local
# Edit .env.local: add your OPENROUTER_API_KEY
npm install && npm run dev
```

## Build Mobile App

```bash
chmod +x build-mobile.sh
./build-mobile.sh
npx cap open ios      # Requires Xcode
npx cap open android  # Requires Android Studio
```

## Features
💬 Chat · ⌨️ Code · 🎨 Images · 📊 Slides · 📄 Docs · 📕 PDF · 📈 Sheets · 🧪 Tests · 🔍 Search

## AI Providers (auto-fallback)
1. **Ollama** (local, free) — tries first
2. **OpenRouter** (cloud, pay per use) — fallback
3. **Anthropic** (cloud, best quality) — optional

## OpenRouter Model Options
| Model | Cost per 1M tokens | Speed | Quality |
|-------|-------------------|-------|---------|
| google/gemini-2.0-flash | $0.10 | Fastest | Good |
| meta-llama/llama-3.3-70b | $0.40 | Fast | Great |
| qwen/qwen-2.5-72b-instruct | $0.90 | Fast | Great |
| anthropic/claude-3.5-sonnet | $3.00 | Medium | Best |

Set in `.env.local`: `OPENROUTER_MODEL=google/gemini-2.0-flash`
