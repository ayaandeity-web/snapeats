# 🥗 SnapEats - AI Food Tracker

SnapEats is a single-page web app for tracking calories, logging meals via AI image recognition, parsing ingredients, and earning rewards through daily streak tracking.

## ✨ Features
- **AI Photo Scan**: Analyze food images and estimate macros (Calories, Protein, Carbs, Fat).
- **Smart Ingredient Logger**: Add individual ingredients and view real-time totals.
- **Dynamic "What to Eat Next" Recommendations**: Live smart meal suggestions based on logged macros.
- **Points, Streaks & Shop**: Daily calorie goals, streak multipliers ($1\times$ to $3\times$), and unlockable visual shop rewards.
- **Light/Dark Mode**: Smooth theme transitions with `localStorage` preference persistence.

## 🚀 Deployment (GitHub Pages)
1. Push this repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Source**, select `Deploy from a branch` and set the branch to `main`.
4. Click **Save**. Your app will be live at `https://<your-username>.github.io/<repository-name>/`.

## 🔑 AI Scanner Setup
Enter your Gemini API key inside the application settings when prompted, or store it in browser `localStorage` as `gemini_api_key`.
