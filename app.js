/* ==========================================================
   SnapEats — app.js
   Handles: photo/homemade capture, backend API calls,
   points system, pet shop, intro slides, mobile nav,
   and local persistence.
========================================================== */

const STORAGE_KEY = "snapeats_state_v1";
const BACKEND_URL_STORAGE = "snapeats_backend_url";
const INTRO_SEEN_STORAGE = "snapeats_intro_seen";

/* ---------------------------------------------------------
   Default backend URL — point this at your deployed backend's
   /api/analyze endpoint (see backend/ folder + README).
   The Groq API key lives only on that server, never here.
--------------------------------------------------------- */
const DEFAULT_BACKEND_URL = "https://snapeats-0w6l.onrender.com";

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
const navBurger = document.getElementById("navBurger");
const navLinksMobile = document.getElementById("navLinksMobile");

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

const backendUrlInput = document.getElementById("backendUrlInput");
const saveBackendBtn = document.getElementById("saveBackendBtn");
const backendStatus = document.getElementById("backendStatus");
const resetDataBtn = document.getElementById("resetDataBtn");

const introOverlay = document.getElementById("introOverlay");
const introTrack = document.getElementById("introTrack");
const introDots = document.getElementById("introDots");
const introNext = document.getElementById("introNext");
const introSkip = document.getElementById("introSkip");

let currentMode = "photo";
let photoBase64 = null;     // base64 (no prefix) for the main photo
let homemadeBase64 = null;  // optional attached photo in homemade mode
let pendingResult = null;   // last analysis result awaiting "log meal"

/* ==========================================================
   Mobile nav
========================================================== */
function initMobileNav(){
  if(!navBurger) return;
  navBurger.addEventListener("click", () => {
    const isOpen = navLinksMobile.classList.toggle("open");
    navBurger.classList.toggle("open", isOpen);
    navBurger.setAttribute("aria-expanded", isOpen);
  });
  navLinksMobile.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinksMobile.classList.remove("open");
      navBurger.classList.remove("open");
      navBurger.setAttribute("aria-expanded", "false");
    });
  });
}

/* ==========================================================
   Intro slides
========================================================== */
const introSlideCount = introTrack ? introTrack.children.length : 0;
let introIndex = 0;

function buildIntroDots(){
  if(!introDots) return;
  introDots.innerHTML = "";
  for(let i = 0; i < introSlideCount; i++){
    const dot = document.createElement("button");
    dot.className = "intro-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => goToIntroSlide(i));
    introDots.appendChild(dot);
  }
}

function goToIntroSlide(i){
  introIndex = Math.max(0, Math.min(introSlideCount - 1, i));
  introTrack.style.transform = `translateX(-${introIndex * (100 / introSlideCount)}%)`;
  [...introDots.children].forEach((dot, idx) => dot.classList.toggle("active", idx === introIndex));
  introNext.textContent = introIndex === introSlideCount - 1 ? "Get started" : "Next";
}

function closeIntro(){
  introOverlay.classList.add("intro-hidden");
  localStorage.setItem(INTRO_SEEN_STORAGE, "1");
  setTimeout(() => { introOverlay.style.display = "none"; }, 400);
}

function initIntro(){
  if(!introOverlay) return;
  if(localStorage.getItem(INTRO_SEEN_STORAGE)){
    introOverlay.style.display = "none";
    return;
  }
  buildIntroDots();
  introTrack.style.width = `${introSlideCount * 100}%`;
  [...introTrack.children].forEach(slide => slide.style.width = `${100 / introSlideCount}%`);
  introNext.addEventListener("click", () => {
    if(introIndex === introSlideCount - 1){
      closeIntro();
    }else{
      goToIntroSlide(introIndex + 1);
    }
  });
  introSkip.addEventListener("click", closeIntro);
}

/* ==========================================================
   Init
========================================================== */
function init(){
  initMobileNav();
  initIntro();
  goalSlider.value = state.goal;
  const savedUrl = localStorage.getItem(BACKEND_URL_STORAGE);
  if(savedUrl){
    backendUrlInput.value = savedUrl;
    backendStatus.textContent = "Using your saved backend ✓";
  }else if(hasDefaultBackend()){
    backendUrlInput.value = DEFAULT_BACKEND_URL;
    backendStatus.textContent = "Using the site's built-in backend ✓";
  }else{
    backendStatus.textContent = "No backend set yet — add one below.";
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
   Backend API
========================================================== */
function getBackendUrl(){
  const saved = localStorage.getItem(BACKEND_URL_STORAGE);
  if(saved) return saved;
  if(hasDefaultBackend()) return DEFAULT_BACKEND_URL;
  return "";
}

function hasDefaultBackend(){
  return Boolean(DEFAULT_BACKEND_URL) && !DEFAULT_BACKEND_URL.includes("YOUR-BACKEND-URL");
}

async function callBackend(payload){
  const url = getBackendUrl();
  if(!url){
    throw new Error("No backend is configured yet. Add your backend URL in Settings first.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    throw new Error(data.error || `Server error (${res.status}).`);
  }
  return data;
}

async function analyzePhoto(base64, note){
  return callBackend({ mode: "photo", base64, note });
}

async function analyzeHomemade(name, ingredients, base64){
  return callBackend({ mode: "homemade", dishName: name, ingredients, base64 });
}

/* ==========================================================
   Analyze button
========================================================== */
analyzeBtn.addEventListener("click", async () => {
  scanError.hidden = true;
  clearResult();

  if(!getBackendUrl()){
    showError("Please add your backend URL in the Settings section below first.");
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
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
saveBackendBtn.addEventListener("click", () => {
  const url = backendUrlInput.value.trim();
  if(!url){
    backendStatus.textContent = "Enter a backend URL first.";
    return;
  }
  localStorage.setItem(BACKEND_URL_STORAGE, url);
  backendStatus.textContent = "Backend URL saved ✓";
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
