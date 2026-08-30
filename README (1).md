# SnapEats 🌱

Snap a photo of your food, get instant AI nutrition info, and grow a garden of pets by eating within your goal.

## Project structure

```
snapeats/
├── index.html          ← frontend
├── style.css           ← frontend (green theme, fully mobile-responsive)
├── app.js              ← frontend
├── favicon.svg          ← site icon (vector)
├── favicon.ico          ← site icon (fallback for older browsers)
├── favicon-16.png / favicon-32.png
├── apple-touch-icon.png ← icon used when saved to an iPhone home screen
├── icon-192.png / icon-512.png ← used by manifest.json for Android/PWA install
├── manifest.json        ← lets phones "Add to Home Screen" with the SnapEats icon
├── README.md
├── .gitignore
└── backend/             ← backend (deployed separately)
    ├── server.js
    ├── package.json
    └── .env.example
```

- **Frontend** (`index.html`, `style.css`, `app.js`) — the site people visit. Hosted free on **GitHub Pages**. Fully responsive: collapsible hamburger menu on mobile, touch-friendly buttons, no zoom-on-focus on iOS.
- **Backend** (`backend/`) — a small Node.js server that holds your Groq API key and talks to Groq on the frontend's behalf. GitHub Pages can't run this (it only serves static files), so it's deployed separately on a free host like **Render**.

**Why a backend at all?**
1. **Security** — your Groq key never appears in the published site's code.
2. **It actually works** — browsers are blocked from calling Groq's API directly (a CORS restriction), so a pure front-end site would build the request and have it silently fail every time. Routing through your own backend fixes that, since the browser only ever talks to your server.

## How it works
1. **Welcome slides** — first-time visitors see a 3-slide intro before landing on the app.
2. **Scan a meal** — take/upload a photo, or switch to "Homemade" and type ingredients.
3. **AI analysis** — the frontend sends the photo (or ingredients) to your backend, which calls Groq's vision model (`qwen/qwen3.6-27b`) and returns calories, protein, carbs, and fat.
4. **Points** — a meal at or under your calorie goal earns more points than one over it; everything still earns something.
5. **Pet shop** — spend points adopting any of 10 pets, from a 20-point Seedling up to a 400-point Dragon.

Points, pets, and meal history are stored in the browser's `localStorage`.

## Part 1: Deploy the backend (do this first)

### Get a Groq API key
Go to https://console.groq.com/keys, sign in, click **Create API Key**, and copy it.

### Deploy on Render (free)
1. Go to https://render.com and sign up/log in (you can use your GitHub account).
2. Push this whole project to GitHub first (see Part 3 below) — Render deploys from a GitHub repo.
3. On Render, click **New +** → **Web Service**.
4. Connect your `snapeats` GitHub repo.
5. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
6. Under **Environment Variables**, add:
   - Key: `GROQ_API_KEY`
   - Value: your real Groq key
7. Click **Create Web Service** and wait for it to deploy (a couple of minutes).
8. Copy the URL Render gives you, e.g. `https://snapeats-backend.onrender.com`. Your full API endpoint is that plus `/api/analyze`:
   ```
   https://snapeats-backend.onrender.com/api/analyze
   ```

> Free Render services "sleep" after inactivity and take ~30–60 seconds to wake up on the first request after a while — normal for the free tier.

### Test it locally first (optional)
```bash
cd backend
cp .env.example .env
# open .env and paste your real key after GROQ_API_KEY=
npm install
npm start
```
Test with:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"mode":"homemade","dishName":"Lentil soup","ingredients":"1 cup red lentils, 1 onion, 1 tbsp olive oil, 2 cups broth"}'
```

## Part 2: Connect the frontend to your backend

Open `app.js`, find this near the top:
```js
const DEFAULT_BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com/api/analyze";
```
Replace it with your real Render URL:
```js
const DEFAULT_BACKEND_URL = "https://snapeats-backend.onrender.com/api/analyze";
```
Visitors can then scan meals immediately with no setup. The Settings section also lets anyone point the app at a *different* backend if they want — optional, and it only affects their own browser.

## Part 3: Publish the frontend on GitHub Pages

### 1. Create the repository
1. Go to https://github.com and log in.
2. Click **+** → **New repository**.
3. Name it `snapeats`, keep it **Public**, don't add a README, click **Create repository**.

### 2. Push everything (frontend + backend folder together)
```bash
git init
git add .
git commit -m "Initial commit: SnapEats"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/snapeats.git
git push -u origin main
```

### 3. Turn the frontend into a live website
1. Repo → **Settings** → **Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
3. Wait a minute, refresh — your live URL appears, e.g.:
   `https://YOUR-USERNAME.github.io/snapeats/`

GitHub Pages only serves the root files — it ignores `backend/`, which is fine since that runs on Render.

### 4. Making updates later
```bash
git add .
git commit -m "Describe what you changed"
git push
```
Both GitHub Pages and Render redeploy automatically from the same repo.

## Mobile compatibility

The site is fully responsive out of the box:
- Nav collapses into a hamburger menu under 780px width
- Buttons and tap targets are sized for touch (44px minimum)
- Text inputs use 16px font to prevent iOS auto-zoom on focus
- Grids (pets, dashboard, results) reflow to fewer columns on small screens
- The camera input (`capture="environment"`) opens the phone's back camera directly when tapping the photo dropzone on mobile

## Notes
- This app uses AI image recognition (Groq's vision model) as its core function, plus a recommender-style points/reward loop — it doesn't work without the AI step, since nutrition values are generated by the model rather than hardcoded.
- Nutrition estimates are AI-generated approximations, not medical or dietary advice.
- Never commit your real `.env` file — it's already excluded in `.gitignore`. Only `.env.example` (no real key) belongs in the repo.
