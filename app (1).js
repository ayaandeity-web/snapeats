/* ==========================================================
   SnapEats — app.js
   Handles: photo/homemade capture, Groq API calls,
   points system, pet shop, and local persistence.
========================================================== */

const STORAGE_KEY = "snapeats_state_v1";
const GROQ_KEY_STORAGE = "snapeats_groq_key";
const GROQ_MODEL = "qwen/qwen3.6-27b"; // Groq's current vision-capable model

/* ---------------------------------------------------------
   Default API key (built into the site so visitors don't
   need their own).

   IMPORTANT — before publishing, replace this with your own
   key AND restrict/monitor it in the Groq Console:
   console.groq.com/keys > your key
     - Set a spend/usage limit so it can't run away
     - Rotate it if you ever suspect misuse
   Anyone who views this page's source can see this key, so
   this is a "reasonable for a class project" level of
   protection, not a bulletproof one. See README.md.
--------------------------------------------------------- */
const DEFAULT_GROQ_KEY = "PASTE_YOUR_GROQ_API_KEY_HERE";

/* ---------- Pet catalog (10 pets) ---------- */
const PETS = [
  { id: "sprout",  name: "Sprout the Seedling", emoji: "🌱", cost: 20  },
  { id: "chirpy",  name: "Chirpy the Chick",    emoji: "🐣", cost: 40  },
  { id: "pebble",  name: "Pebble the Turtle",   emoji: "🐢", cost: 60  },
  { id: "clover",  name: "Clover the Bunny",    emoji: "🐰", cost: 90  },
  { id: "ember",   name: "Ember the Fox",       emoji: "🦊", cost: 120 },
  { id: "juniper", name: "Juniper the Owl",     emoji: "🦉", cost: 160 },
  { id: "hazel",   name: "Hazel the Hedgehog",  emoji: "🦔", cost: 200 },
  { id: "koa",     name: "Koa the Panda",       emoji: "🐼", cost: 260 },
  { id: "finn",    name: "Finn the Penguin",    emoji: "🐧", cost: 320 },
  { id: "orion",   name: "Orion the Dragon",    emoji: "🐉", cost: 400 },
];

/* ---------- State ---------- */
let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* ignore corrupt state */ }
  return { points: 0, goal: 700, streak: 0, owned: [], history: [] };
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Elements ---------- */
const navPointsValue = document.getElementById("navPointsValue");
const dashPoints = document.getElementById("dashPoints");
const dashGoal = document.getElementById("dashGoal");
const dashStreak = document.getElementById("dashStreak");
const goalSlider = document.getElementById("goalSlider");
const historyList = document.getElementById("historyList");
const petGrid = document.getElementById("petGrid");

const modePhotoBtn = document.getElementById("modePhotoBtn");
const modeHomemadeBtn = document.getElementById("modeHomemadeBtn");
const photoMode = document.getElementById("photoMode");
const homemadeMode = document.getElementById("homemadeMode");

const photoInput = document.getElementById("photoInput");
const preview = document.getElementById("preview");
const dropzoneHint = document.getElementById("dropzoneHint");
const photoNote = document.getElementById("photoNote");

const dishName = document.getElementById("dishName");
const ingredientsInput = document.getElementById("ingredientsInput");
const homemadePhotoInput = document.getElementById("homemadePhotoInput");
const homemadePreview = document.getElementById("homemadePreview");
const homemadeDropzoneHint = document.getElementById("homemadeDropzoneHint");

const analyzeBtn = document.getElementById("analyzeBtn");
const scanError = document.getElementById("scanError");

const resultCard = document.getElementById("resultCard");
const resultFoodName = document.getElementById("resultFoodName");
const resultPointsBadge = document.getElementById("resultPointsBadge");
const statCalories = document.getElementById("statCalories");
const statProtein = document.getElementById("statProtein");
const statCarbs = document.getElementById("statCarbs");
const statFat = document.getElementById("statFat");
const resultNote = document.getElementById("resultNote");
const logMealBtn = document.getElementById("logMealBtn");

const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const keyStatus = document.getElementById("keyStatus");
const resetDataBtn = document.getElementById("resetDataBtn");

let currentMode = "photo";
let photoBase64 = null;     // base64 (no prefix) for the main photo
let homemadeBase64 = null;  // optional attached photo in homemade mode
let pendingResult = null;   // last analysis result awaiting "log meal"

/* ==========================================================
   Init
========================================================== */
function init(){
  goalSlider.value = state.goal;
  const savedKey = localStorage.getItem(GROQ_KEY_STORAGE);
  if(savedKey){
    apiKeyInput.value = savedKey;
    keyStatus.textContent = "Using your saved key ✓";
  }else if(hasDefaultKey()){
    keyStatus.textContent = "Using the site's built-in key ✓ (you can override it below)";
  }
  renderStats();
  renderPets();
  renderHistory();
}

function renderStats(){
  navPointsValue.textContent = state.points;
  dashPoints.textContent = state.points;
  dashGoal.textContent = state.goal;
  dashStreak.textContent = state.streak;
}

function renderHistory(){
  historyList.innerHTML = "";
  if(state.history.length === 0){
    historyList.innerHTML = `<li class="history-empty">No meals logged yet — scan your first one above.</li>`;
    return;
  }
  // most recent first
  [...state.history].reverse().forEach(entry => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="history-name">${escapeHtml(entry.name)}</span>
      <span class="history-meta">${entry.calories} kcal · ${entry.date}</span>
      <span class="chip ${entry.underGoal ? 'chip-good' : ''}">+${entry.pointsAwarded} pts</span>
    `;
    historyList.appendChild(li);
  });
}

function renderPets(){
  petGrid.innerHTML = "";
  PETS.forEach(pet => {
    const owned = state.owned.includes(pet.id);
    const card = document.createElement("div");
    card.className = "pet-card" + (owned ? "" : " locked");
    card.innerHTML = `
      <span class="pet-emoji">${pet.emoji}</span>
      <span class="pet-name">${pet.name}</span>
      <span class="pet-cost">${pet.cost} pts</span>
      ${owned
        ? `<span class="pet-owned-badge">Adopted ✓</span>`
        : `<button class="btn btn-primary" data-pet="${pet.id}" ${state.points < pet.cost ? "disabled" : ""}>Adopt</button>`
      }
    `;
    petGrid.appendChild(card);
  });

  petGrid.querySelectorAll("button[data-pet]").forEach(btn => {
    btn.addEventListener("click", () => adoptPet(btn.dataset.pet));
  });
}

function adoptPet(petId){
  const pet = PETS.find(p => p.id === petId);
  if(!pet || state.owned.includes(petId)) return;
  if(state.points < pet.cost) return;
  state.points -= pet.cost;
  state.owned.push(petId);
  saveState();
  renderStats();
  renderPets();
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================
   Mode toggle
========================================================== */
modePhotoBtn.addEventListener("click", () => setMode("photo"));
modeHomemadeBtn.addEventListener("click", () => setMode("homemade"));

function setMode(mode){
  currentMode = mode;
  const isPhoto = mode === "photo";
  modePhotoBtn.classList.toggle("active", isPhoto);
  modeHomemadeBtn.classList.toggle("active", !isPhoto);
  modePhotoBtn.setAttribute("aria-selected", isPhoto);
  modeHomemadeBtn.setAttribute("aria-selected", !isPhoto);
  photoMode.hidden = !isPhoto;
  homemadeMode.hidden = isPhoto;
  clearResult();
}

/* ==========================================================
   Photo capture / preview
========================================================== */
photoInput.addEventListener("change", (e) => handleFile(e.target.files[0], preview, dropzoneHint, (b64) => photoBase64 = b64));
homemadePhotoInput.addEventListener("change", (e) => handleFile(e.target.files[0], homemadePreview, homemadeDropzoneHint, (b64) => homemadeBase64 = b64));

function handleFile(file, imgEl, hintEl, setBase64){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    imgEl.src = dataUrl;
    imgEl.hidden = false;
    hintEl.hidden = true;
    setBase64(dataUrl.split(",")[1]);
  };
  reader.readAsDataURL(file);
}

/* ==========================================================
   Groq API
========================================================== */
function getApiKey(){
  const userKey = localStorage.getItem(GROQ_KEY_STORAGE);
  if(userKey) return userKey;
  if(DEFAULT_GROQ_KEY && DEFAULT_GROQ_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE"){
    return DEFAULT_GROQ_KEY;
  }
  return "";
}

function hasDefaultKey(){
  return Boolean(DEFAULT_GROQ_KEY) && DEFAULT_GROQ_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";
}

async function callGroq(content){
  const key = getApiKey();
  if(!key){
    throw new Error("Add your Groq API key in Settings first.");
  }
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: GROQ_MODEL,
    messages: [{ role: "user", content }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}). ${errText.slice(0,200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function extractJson(text){
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if(start === -1 || end === -1) throw new Error("AI response wasn't in the expected format.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const NUTRITION_INSTRUCTIONS = `You are a nutrition estimation assistant for a food-tracking app.
Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{"foodName": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "note": string}
"note" should be one short encouraging or informative sentence (max 20 words) about the meal's nutritional balance.
Give your best realistic estimate for a single typical portion even if exact values are uncertain.`;

async function analyzePhoto(base64, note){
  const content = [
    { type: "text", text: `${NUTRITION_INSTRUCTIONS}\nAnalyze the food in this photo.${note ? " Extra context from the user: " + note : ""}` },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
  ];
  const text = await callGroq(content);
  return extractJson(text);
}

async function analyzeHomemade(name, ingredients, base64){
  const content = [
    { type: "text", text: `${NUTRITION_INSTRUCTIONS}\nThis is a homemade dish called "${name || 'Homemade dish'}". Estimate nutrition from these ingredients and rough quantities:\n${ingredients}` }
  ];
  if(base64){
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
  }
  const text = await callGroq(content);
  return extractJson(text);
}

/* ==========================================================
   Analyze button
========================================================== */
analyzeBtn.addEventListener("click", async () => {
  scanError.hidden = true;
  clearResult();

  if(!getApiKey()){
    showError("Please add your Groq API key in the Settings section below first.");
    return;
  }

  analyzeBtn.disabled = true;
  const originalLabel = analyzeBtn.textContent;
  analyzeBtn.textContent = "Analyzing…";

  try{
    let result;
    if(currentMode === "photo"){
      if(!photoBase64){
        throw new Error("Please add a photo of your meal first.");
      }
      result = await analyzePhoto(photoBase64, photoNote.value.trim());
    }else{
      if(!ingredientsInput.value.trim()){
        throw new Error("Please list your ingredients first.");
      }
      result = await analyzeHomemade(dishName.value.trim(), ingredientsInput.value.trim(), homemadeBase64);
    }
    showResult(result);
  }catch(err){
    showError(err.message || "Something went wrong analyzing that meal.");
  }finally{
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = originalLabel;
  }
});

function showError(msg){
  scanError.textContent = msg;
  scanError.hidden = false;
}

function clearResult(){
  resultCard.hidden = true;
  pendingResult = null;
}

function calcPoints(calories, goal){
  if(calories <= goal){
    // Reward staying further under goal, capped for balance.
    const margin = goal - calories;
    return Math.max(15, Math.min(50, 15 + Math.round(margin / 20)));
  }
  return 5; // participation points even when over goal
}

function showResult(result){
  const calories = Math.round(Number(result.calories) || 0);
  const underGoal = calories <= state.goal;
  const points = calcPoints(calories, state.goal);

  pendingResult = {
    name: result.foodName || "Your meal",
    calories,
    protein: Math.round(Number(result.protein_g) || 0),
    carbs: Math.round(Number(result.carbs_g) || 0),
    fat: Math.round(Number(result.fat_g) || 0),
    note: result.note || "",
    underGoal,
    pointsAwarded: points
  };

  resultFoodName.textContent = pendingResult.name;
  resultPointsBadge.textContent = `+${points} pts`;
  resultPointsBadge.className = "chip " + (underGoal ? "chip-good" : "");
  statCalories.textContent = pendingResult.calories;
  statProtein.textContent = pendingResult.protein + "g";
  statCarbs.textContent = pendingResult.carbs + "g";
  statFat.textContent = pendingResult.fat + "g";
  resultNote.textContent = pendingResult.note +
    (underGoal ? " You're under your goal — nice." : " That's above your goal, but every log still earns points.");

  resultCard.hidden = false;
}

logMealBtn.addEventListener("click", () => {
  if(!pendingResult) return;
  state.points += pendingResult.pointsAwarded;
  if(pendingResult.underGoal) state.streak += 1;
  state.history.push({
    name: pendingResult.name,
    calories: pendingResult.calories,
    pointsAwarded: pendingResult.pointsAwarded,
    underGoal: pendingResult.underGoal,
    date: new Date().toLocaleDateString()
  });
  saveState();
  renderStats();
  renderHistory();
  renderPets();
  resultCard.hidden = true;
  logMealBtn.textContent = "Logged ✓";
  setTimeout(() => { logMealBtn.textContent = "Log this meal & collect points"; }, 1500);
});

/* ==========================================================
   Dashboard goal slider
========================================================== */
goalSlider.addEventListener("input", () => {
  state.goal = Number(goalSlider.value);
  dashGoal.textContent = state.goal;
  saveState();
});

/* ==========================================================
   Settings
========================================================== */
saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if(!key){
    keyStatus.textContent = "Enter a key first.";
    return;
  }
  localStorage.setItem(GROQ_KEY_STORAGE, key);
  keyStatus.textContent = "Key saved ✓";
});

resetDataBtn.addEventListener("click", () => {
  if(!confirm("This clears all points, pets, and meal history on this device. Continue?")) return;
  state = { points: 0, goal: 700, streak: 0, owned: [], history: [] };
  saveState();
  goalSlider.value = state.goal;
  renderStats();
  renderPets();
  renderHistory();
});

init();
