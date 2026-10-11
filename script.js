/**
 * Memoria AI - Palliative & Memory Care Assistant
 * Voice output: ElevenLabs only
 */

// On-screen message so problems are visible without opening the console
function notify(msg) {
  let el = document.getElementById("memoria-notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "memoria-notice";
    el.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#b3261e;color:#fff;padding:12px 16px;border-radius:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer";
    el.onclick = () => el.remove();
    (document.body || document.documentElement).appendChild(el);
  }
  el.textContent = msg + "  (tap to dismiss)";
}
window.addEventListener("error", (e) => notify("Script error: " + e.message));

// Everything runs after the page is ready, wherever the <script> tag is placed
function memoriaMain() {
  Object.assign(window, { addMsg, applySettings, applySudokuInput, ask, closeCelebrationModal, drawMedications, drawPhotos, drawSudokuGrid, elevenConfigured, initApp, loadSavedSettings, loadWordPuzzle, newSudokuPuzzle, nextWordPuzzle, offlineAssistant, onCardClicked, pickWordLetter, provideSudokuHint, removeMedication, removePhoto, renderCaregiverChart, resetMemoryMatchGame, resetFacesGame, resetEyesGame, resetStoryGame, speak, stopSpeaking, handleCommand, aiReply, sfx, gameIntro, confettiBurst, browserSpeak, switchGame, switchMainTab, toggleVoiceGuidance, triggerCelebrationModal, unlockAudio, saveMemoryNote, readMemoryNotes, deleteMemoryNote, drawMemoryNotes, drawTodaysMeds, gotoMeds, toggleMobileMenu, toggleAiHelper, aiHelperAction, wireAiHelper, setAiStatus, renderSuggestions, setTextSize, setVoiceSpeed, applyComfort, setBilling, openCheckout, closeCheckout }); // for onclick="..." in your HTML

// Utility Helpers
const missingEls = new Set();
const $ = (s) => {
  const el = document.querySelector(s);
  if (el) return el;
  if (!missingEls.has(s)) {
    missingEls.add(s);
    console.warn("Element not found in your HTML:", s);
  }
  return document.createElement("div"); // harmless stand-in so the rest keeps working
};
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
const fmtDose = (m) => {
  const d = String(m.dose ?? "").trim();
  if (!d) return "";
  return /mg|iu|ml|mcg|\bg\b/i.test(d) ? ` ${d}` : ` ${d} mg`;
};

// Local Storage Wrapper
const store = {
  get(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch (e) {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};

// Global State
// ====================================================
// ELEVENLABS CONFIG - the ONLY place to set these two values
// ====================================================
let ELEVEN_API_KEY = localStorage.getItem("memoria_eleven") || ""; // set in Settings, never hardcode
const ELEVEN_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
// Different voice per mini-game (ElevenLabs ids; browser voices get different pitch/rate)
const GAME_VOICES = {
  default: { id: ELEVEN_VOICE_ID, pitch: 1, rate: 0.9 },
  sudoku: { id: "pNInz6obpgDQGcFmaJgB", pitch: 0.85, rate: 0.85 },
  word: { id: "21m00Tcm4TlvDq8ikWAM", pitch: 1.1, rate: 0.9 },
  pairs: { id: "ErXwobaYiN019PkySvjV", pitch: 1.25, rate: 1 },
  faces: { id: "ErXwobaYiN019PkySvjV", pitch: 1.1, rate: 0.9 },
  eyes: { id: "pNInz6obpgDQGcFmaJgB", pitch: 1, rate: 1 },
  story: { id: "21m00Tcm4TlvDq8ikWAM", pitch: 1, rate: 0.85 },
};

// Saved settings never carry ElevenLabs values (drops anything stored by older versions)
function loadSavedSettings() {
  const saved = store.get("memoria_settings", {});
  delete saved.elevenKey;
  delete saved.elevenVoiceId;
  delete saved.apiKey; // old Gemini key from earlier versions
  return saved;
}

let S = Object.assign(
  {
    patient: "Arthur",
    location: "Baku, Azerbaijan",
    caregiver: "Sarah",
    phone: "",
    lang: "en-US",
    textSize: "normal",
    voiceSpeed: "normal",
  },
  loadSavedSettings()
);

let meds = store.get("memoria_meds", [
  { name: "Donepezil", time: "09:00", dose: "5", freq: "Daily" },
  { name: "Heart Care Omega", time: "12:00", dose: "1000", freq: "Daily" }
]);

let photos = store.get("memoria_photos", []);

let voiceGuidanceActive = true;

// ----------------------------------------------------
// Navigation & Views
// ----------------------------------------------------
function switchMainTab(tab) {
  const tabs = [
    { id: "patient", panel: "#patientPanel" },
    { id: "brain-gym", panel: "#brainGymPanel" },
    { id: "caregiver", panel: "#caregiverPanel" }
  ];

  tabs.forEach((t) => {
    const isCurrent = t.id === tab;
    const panel = document.querySelector(t.panel);
    if (!panel) return;
    panel.classList.toggle("hidden", !isCurrent);
    panel.classList.toggle("flex", isCurrent);
  });
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));

  $$(".nav-tab-btn").forEach((btn) => {
    const isCurrent = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", isCurrent);
    btn.setAttribute("aria-current", isCurrent ? "page" : "false");
  });
}

function toggleMobileMenu(open) {
  const m = document.getElementById("mobileMenu");
  if (m) m.classList.toggle("hidden", !open);
  document.body.style.overflow = open ? "hidden" : "";
}

function gotoMeds() {
  switchMainTab("caregiver");
  setTimeout(() => { const el = document.getElementById("medList"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
}

function tickClock() {
  const now = new Date();
  const t = document.getElementById("clockTime");
  const d = document.getElementById("clockDate");
  if (t) t.textContent = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d) d.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
if (!window.__memoriaClock) window.__memoriaClock = setInterval(tickClock, 30000);

function drawTodaysMeds() {
  const box = document.getElementById("todaysMedsPreview");
  if (!box) return;
  const items = meds.slice(0, 3);
  const dots = ["8:00 AM · 1 tablet", "12:00 PM · 1 tablet", "8:00 PM · 1 tablet"];
  const names = items.length ? items.map((m, i) => ({ name: `${m.name}${fmtDose(m)}`, sub: `${m.time} · ${m.freq}`, done: i < 2 })) : [
    { name: "Donepezil 10mg", sub: "8:00 AM · 1 tablet", done: true },
    { name: "Memantine 10mg", sub: "12:00 PM · 1 tablet", done: true },
    { name: "Vitamin D3 1000 IU", sub: "8:00 PM · 1 tablet", done: false },
  ];
  void dots;
  box.innerHTML = names.map((n) => `
    <div class="flex items-center gap-3">
      <span class="med-check ${n.done ? "done" : ""}">${n.done ? "✓" : ""}</span>
      <div class="flex flex-col text-left"><span class="font-headline text-sm font-bold">${esc(n.name)}</span><span class="text-xs text-on-surface-variant">${esc(n.sub)}</span></div>
    </div>`).join("");
  const next = names.find((n) => !n.done);
  const nd = document.getElementById("nextDoseText");
  if (nd && next) nd.textContent = next.sub.split("·")[0].trim();
}

function switchGame(gameType) {
  gameIntro(gameType);
  const games = ["sudoku", "word", "pairs", "faces", "eyes", "story"];
  games.forEach((g) => {
    const view = $(`#game-${g}`);
    const btn = $(`#tab-btn-${g}`);
    const isCurrent = g === gameType;

    if (view) {
      view.classList.toggle("hidden", !isCurrent);
      view.classList.toggle("flex", isCurrent);
    }

    if (btn) btn.classList.toggle("is-active", isCurrent);
  });
}

// ----------------------------------------------------
// Settings Management
// ----------------------------------------------------
const settingsModal = $("#settingsModal");

$("#settingsBtn").onclick = () => {
  $("#patientNameInput").value = S.patient || "Arthur";
  $("#locationInput").value = S.location || "Baku, Azerbaijan";
  $("#caregiverNameInput").value = S.caregiver || "Sarah";
  $("#caregiverPhoneInput").value = S.phone || "";

  $("#langSelect").value = S.lang || "en-US";
  $("#apiKeyInput").value = localStorage.getItem("memoria_gemini") || "";
  $("#elevenKeyInput").value = ELEVEN_API_KEY;
  paintComfortButtons();
  settingsModal.classList.remove("hidden");
};

$("#closeModal").onclick = () => settingsModal.classList.add("hidden");
settingsModal.onclick = (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
};

$("#saveSettings").onclick = () => {
  S = {
    patient: $("#patientNameInput").value.trim() || "Arthur",
    location: $("#locationInput").value.trim() || "Baku, Azerbaijan",
    caregiver: $("#caregiverNameInput").value.trim() || "Sarah",
    phone: $("#caregiverPhoneInput").value.trim(),
    lang: $("#langSelect").value,
    textSize: S.textSize || "normal",
    voiceSpeed: S.voiceSpeed || "normal",
  };
  localStorage.setItem("memoria_gemini", $("#apiKeyInput").value.trim());
  ELEVEN_API_KEY = $("#elevenKeyInput").value.trim();
  localStorage.setItem("memoria_eleven", ELEVEN_API_KEY);
  store.set("memoria_settings", S);
  applySettings();
  settingsModal.classList.add("hidden");
  speak(`Settings updated. Hello ${S.patient}, you are safe at home.`);
};

// Apply Settings to UI
function applySettings() {
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";

  if ($("#greetingText")) {
    $("#greetingText").textContent = `Welcome, ${S.patient}!`;
  }
  if ($("#greetingEyebrow")) {
    $("#greetingEyebrow").textContent = `Good ${greeting}`;
  }
  if ($("#locationText")) {
    $("#locationText").textContent = `You're doing great today. Safe at home in ${S.location}.`;
  }
  if ($("#gpsLocation")) {
    $("#gpsLocation").textContent = S.location;
  }
  if ($("#caregiverLocation")) {
    $("#caregiverLocation").textContent = S.location;
  }
  if ($("#audioNoteBtnText")) {
    $("#audioNoteBtnText").textContent = `Play ${S.caregiver}'s reassuring voice note`;
  }
  if ($("#emergencyBtnText")) {
    $("#emergencyBtnText").textContent = `Call caregiver (${S.caregiver})`;
  }
  if ($("#celebTitle")) {
    $("#celebTitle").textContent = `Great Job, ${S.patient}!`;
  }

  // Header orientation badge
  const weekday = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const city = S.location.split(",")[0].trim();
  if ($("#topOrientationBadge")) {
    $("#topOrientationBadge").textContent = `${weekday} • Safe at Home in ${city}`;
  }

  // Memory card avatar
  const firstPhoto = photos[0];
  const heroAvatar = document.getElementById("heroAvatar");
  if (firstPhoto) {
    $("#memoryName").textContent = firstPhoto.name;
    $("#memoryRelation").textContent = "(" + firstPhoto.relation + ")";
    $("#memoryAvatar").innerHTML = `<img src="${firstPhoto.src}" alt="${esc(firstPhoto.name)}" class="w-full h-full object-cover">`;
    if (heroAvatar) heroAvatar.innerHTML = `<img src="${firstPhoto.src}" alt="${esc(S.patient)}" class="w-full h-full object-cover">`;
  } else {
    $("#memoryName").textContent = S.caregiver;
    $("#memoryRelation").textContent = "(Daughter)";
    $("#memoryAvatar").innerHTML = `<span class="material-symbols-outlined text-primary text-[40px]">person</span>`;
    if (heroAvatar) heroAvatar.innerHTML = `<span class="material-symbols-outlined text-primary text-[36px]">person</span>`;
  }
  tickClock();
  drawTodaysMeds();
}

// Comfort display: text size + voice speed presets
function applyComfort() {
  const root = document.documentElement;
  root.classList.toggle("text-large", S.textSize === "large");
  root.classList.toggle("text-xl", S.textSize === "xl");
}
function paintComfortButtons() {
  const map = { textSizeNormal: "normal", textSizeLarge: "large", textSizeXL: "xl", voiceSlow: "slow", voiceNormal: "normal", voiceFast: "fast" };
  for (const [id, val] of Object.entries(map)) {
    const b = document.getElementById(id);
    if (!b) continue;
    const on = id.startsWith("textSize") ? S.textSize === val : S.voiceSpeed === val;
    b.classList.toggle("text-size-on", !!on);
  }
}
function setTextSize(mode) {
  S.textSize = mode;
  store.set("memoria_settings", S);
  applyComfort();
  paintComfortButtons();
}
function setVoiceSpeed(mode) {
  S.voiceSpeed = mode;
  store.set("memoria_settings", S);
  paintComfortButtons();
}
function voiceRate(base) {
  if (S.voiceSpeed === "slow") return base * 0.85;
  if (S.voiceSpeed === "fast") return base * 1.12;
  return base;
}

// ----------------------------------------------------
// Voice output: ElevenLabs only
// ----------------------------------------------------
const ELEVEN_MODEL = "eleven_flash_v2_5"; // low latency; use "eleven_multilingual_v2" for higher quality
const audioCache = new Map(); // saves credits on repeated phrases
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

// One shared audio element. Once it is "unlocked" by a user tap,
// browsers (especially Safari/mobile) allow later programmatic playback.
const player = new Audio();
player.defaultPlaybackRate = 0.95; // gentle pacing; set to 1 for normal speed
let audioUnlocked = false;
let speakToken = 0;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  player.src = SILENT_WAV;
  player.play().catch(() => {
    audioUnlocked = false; // try again on the next tap
  });
}
["pointerdown", "touchstart", "keydown"].forEach((ev) =>
  document.addEventListener(ev, unlockAudio, { passive: true })
);

function stopSpeaking() {
  player.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function elevenConfigured() {
  return (
    ELEVEN_API_KEY &&
    ELEVEN_VOICE_ID &&
    !ELEVEN_API_KEY.startsWith("YOUR_") &&
    !ELEVEN_VOICE_ID.startsWith("YOUR_")
  );
}

// Speak: ElevenLabs when a key is set, otherwise free browser voices. `game` picks the game voice.
async function speak(text, game = "default") {
  if (!voiceGuidanceActive || !text) return;
  stopSpeaking();
  const token = ++speakToken;
  const v = GAME_VOICES[game] || GAME_VOICES.default;
  if (elevenConfigured() && (S.lang || "en-US") === "en-US") {
    try {
      const key = v.id + "|" + text;
      let url = audioCache.get(key);
      if (!url) {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": ELEVEN_API_KEY, Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.75, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true } }),
        });
        if (!res.ok) throw new Error("ElevenLabs " + res.status);
        url = URL.createObjectURL(await res.blob());
        audioCache.set(key, url);
      }
      if (token !== speakToken) return;
      player.src = url;
      player.playbackRate = voiceRate(0.95);
      await player.play();
      return;
    } catch (err) {
      console.warn("ElevenLabs failed, using browser voice:", err);
    }
  }
  if (token === speakToken) browserSpeak(text, v);
}
function browserSpeak(text, v) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = S.lang || "en-US";
  u.pitch = v.pitch;
  u.rate = voiceRate(v.rate);
  const match = speechSynthesis.getVoices().find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
  if (match) u.voice = match;
  speechSynthesis.speak(u);
}

// ----------------------------------------------------
// Game sound effects (synthesized, no files needed)
// ----------------------------------------------------
let _ac;
function sfx(type) {
  if (!voiceGuidanceActive) return;
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume().catch(() => {});
    const seq = {
      place: [[523, 0.09]], clear: [[330, 0.08]], flip: [[440, 0.06]],
      correct: [[523, 0.12], [659, 0.12], [784, 0.2]], match: [[659, 0.1], [880, 0.2]],
      oops: [[220, 0.18], [196, 0.22]], win: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]],
    }[type] || [];
    let t = _ac.currentTime;
    seq.forEach(([f, d]) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type === "oops" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(_ac.destination);
      o.start(t); o.stop(t + d + 0.02);
      t += d * 0.9;
    });
  } catch (e) {}
}
function gameIntro(g) {
  const t = {
    sudoku: "Sudoku time. Tap an empty box, then choose a number. Or just say: fill two.",
    word: "Word recall. Look at the picture and find the missing letter. You can say: letter E.",
    pairs: "Memory pairs. Turn over two cards and find the matches. Take all the time you like.",
    faces: "Faces and names. Meet three friendly people and remember their names.",
    eyes: "Quick eyes. Look carefully and tap the picture I name.",
    story: "Your day story. Put your morning steps back in order.",
  }[g];
  if (t && audioUnlocked) speak(t, g);
}
function confettiBurst() {
  const c = $("#confettiCanvas"), x = c.getContext && c.getContext("2d");
  if (!x) return;
  c.width = innerWidth; c.height = innerHeight;
  const cols = ["#F97316", "#34D399", "#FDBA74", "#A7F3D0", "#FB923C"];
  const P = Array.from({ length: 140 }, () => ({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 2, r: 4 + Math.random() * 5, col: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; x.fillStyle = p.col; x.fillRect(p.x, p.y, p.r, p.r * 0.6); });
    if (++f < 150) requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height);
  })();
}

// ----------------------------------------------------
// Assistant (offline, built-in replies)
// ----------------------------------------------------
const convLog = $("#conversationLog");

function addMsg(text, who) {
  const isAI = who === "ai";
  const item = document.createElement("div");
  item.className = `flex gap-3 max-w-[88%] ${isAI ? "self-start" : "self-end flex-row-reverse"}`;

  const avatar = document.createElement("div");
  avatar.className = `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-sm ${
    isAI ? "bg-primary-container text-on-primary-container" : "bg-secondary text-on-secondary"
  }`;
  avatar.innerHTML = `<span class="material-symbols-outlined text-[20px]">${isAI ? "psychology" : "person"}</span>`;

  const bubble = document.createElement("div");
  bubble.className = `p-4 rounded-xl text-base leading-relaxed shadow-sm ${
    isAI
      ? "ai-bubble text-on-surface shadow-sm"
      : "bg-primary text-on-primary rounded-tr-none"
  }`;
  bubble.textContent = text;
  if (isAI) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "msg-copy";
    copy.title = "Copy message";
    copy.setAttribute("aria-label", "Copy message");
    copy.innerHTML = '<span class="material-symbols-outlined text-[16px]">content_copy</span>';
    copy.onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
      copy.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span>';
      setTimeout(() => { copy.innerHTML = '<span class="material-symbols-outlined text-[16px]">content_copy</span>'; }, 1200);
    };
    bubble.appendChild(copy);
  }

  item.appendChild(avatar);
  item.appendChild(bubble);
  convLog.appendChild(item);
  convLog.scrollTop = convLog.scrollHeight;
}

// ----------------------------------------------------
// Memoria Brain: offline-first, Alzheimer-aware replies.
// Validation therapy: comfort first, never argue with confusion,
// gently orient (name, home, time of day), invite stories.
// ----------------------------------------------------
let _lastQ = "";
let _lastCount = 0;
let _jokeIdx = 0;

function timeOfDay() {
  const h = new Date().getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
function medsLine() {
  if (!meds.length) return "no medicine on your list right now";
  return meds.map((m) => `${m.name}${fmtDose(m)} at ${m.time}`).join(", ");
}
function routineNext() {
  const rows = $$("#routineList .routine-row");
  for (const r of rows) {
    const box = r.querySelector("input");
    if (box && !box.checked) {
      const t = r.querySelector(".routine-title");
      const time = r.querySelector(".time-pill");
      return { title: t ? t.textContent.trim() : "your next step", time: time ? time.textContent.trim() : "" };
    }
  }
  return null;
}
function familyNames() {
  const names = photos.map((p) => p.name).filter(Boolean);
  if (S.caregiver && !names.includes(S.caregiver)) names.unshift(S.caregiver);
  return names;
}
const JOKES = [
  "Why did the garden flower smile? Because the sun said good morning.",
  "What does a friendly teacup say? You are tea-riffic today.",
  "Why do birds sing in the morning? To remind us the day is beautiful.",
  "What did the big clock say to the little clock? Take your time, little one.",
];
function normQ(q) {
  return String(q || "").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0100-\u017f ]/gi, "").trim();
}
function detectMood(q) {
  const m = normQ(q).match(/(?:i feel|i am|i m)\s+(scared|afraid|sad|lonely|happy|angry|upset|tired|sleepy|confused|lost|bored|nervous|worried|sick|good|great|fine|okay|ok|wonderful|hungry|thirsty)/);
  if (m) store.set("memoria_mood", m[1]);
  return m ? m[1] : "";
}

// Topic memory: remembers what was just discussed to answer follow-ups
// ("what about her?", "and then?", "tell me more") with its own mind.
function rememberTopic(q, ans) {
  const t = normQ(q);
  let topic = "";
  if (/medic|pill|dose|routine|schedule|doctor/.test(t)) topic = "meds";
  else if (/sarah|caregiver|daughter|son|family|mother|father/.test(t) || familyNames().some((n) => n && t.includes(n.toLowerCase()))) topic = "family";
  else if (/game|play|faces|story|eyes|puzzle|bored/.test(t)) topic = "games";
  else if (/time|day|date|where|home|location/.test(t)) topic = "orientation";
  else if (/scared|sad|lonel|afraid|confus|nervous|worried|upset/.test(t)) topic = "feelings";
  else topic = "chat";
  store.set("memoria_topic", { topic, q: String(q).slice(0, 80), a: String(ans).slice(0, 160) });
}
function topicFollowup(q) {
  const t = normQ(q);
  if (!/^(and|what about|how about|tell me more|more|and then|why|really|oh|hmm|yes|yeah|ok)/.test(t)) return null;
  const mem = store.get("memoria_topic", null);
  if (!mem || !mem.topic) return null;
  const fam = familyNames();
  const main = fam[0] || S.caregiver;
  if (mem.topic === "meds") return `${S.patient}, about your medicine: ${medsLine()}. ${S.caregiver} keeps it all safe. Anything else?`;
  if (mem.topic === "family") return `${main} loves you very much, ${S.patient}. Would you like to hear a voice note or look at familiar faces?`;
  if (mem.topic === "games") return `Let's play, ${S.patient}! I will open Brain Gym for you now.`;
  if (mem.topic === "orientation") return `You are safe at home in ${S.location}, ${S.patient}. It is ${timeOfDay()} and all is calm.`;
  if (mem.topic === "feelings") return `I am still right here with you, ${S.patient}. Breathe slowly with me. You are safe.`;
  return null;
}

function offlineAssistant(q) {
  const query = normQ(q);
  const now = new Date();
  const tod = timeOfDay();
  const fam = familyNames();
  const mood = store.get("memoria_mood", "");

  if (!query || query.length < 2) {
    return `I am here, ${S.patient}. Would you like to talk, play a game, or hear a story?`;
  }
  // --- follow-ups resolve against remembered topic ---
  const follow = topicFollowup(q);
  if (follow) return follow;
  // --- greetings & small talk ---
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|salam|merhaba|privet|gunaydin)/.test(query)) {
    return `Hello, ${S.patient}! It is a lovely ${tod}. How are you feeling right now?`;
  }
  if (/how are you/.test(query)) {
    return `I am happy to be with you, ${S.patient}. How are you feeling today?`;
  }
  if (/thank/.test(query)) {
    return `You are so welcome, ${S.patient}. I am always here with you.`;
  }
  if (/i love you|love you/.test(query)) {
    return `And I care about you very much, ${S.patient}. ${S.caregiver} loves you dearly too.`;
  }
  if (/good night|going to (bed|sleep)/.test(query)) {
    return `Good night, ${S.patient}. Sleep warm and safe. I will be right here in the ${tod === "night" ? "night" : "morning"} with you.`;
  }
  if (/^(bye|goodbye|see you)/.test(query)) {
    return `Goodbye for now, ${S.patient}. You are safe, and I will be here whenever you need me.`;
  }
  // --- time orientation ---
  if (/what year|which year/.test(query)) {
    return `It is ${now.getFullYear()}, ${S.patient}. A calm ${now.toLocaleDateString("en-US", { month: "long" })} ${tod}.`;
  }
  if (/season|winter|summer|spring|autumn|fall/.test(query)) {
    const m = now.getMonth();
    const season = m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
    return `It is ${season}, ${S.patient}. ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`;
  }
  if (/morning|afternoon|evening|night|part of the day|time of day/.test(query) && !/good (morning|afternoon|evening)/.test(query)) {
    return `It is the ${tod}, ${S.patient}. ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. You are right on schedule.`;
  }
  if (/time|clock|hour/.test(query)) {
    return `It is ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, ${S.patient}. You are right on schedule.`;
  }
  if (/day|date|today|month/.test(query)) {
    return `Today is ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${S.patient}. A lovely ${tod}.`;
  }
  // --- place orientation ---
  if (/country|city|town|village|address/.test(query)) {
    return `You live in ${S.location}, ${S.patient}. Your warm, safe home.`;
  }
  if (/where|location|home|place/.test(query)) {
    return `You are completely safe at home in ${S.location}, ${S.patient}. Everything is peaceful here.`;
  }
  if (/outside|garden|walk|weather|rain|sun|cold|hot/.test(query)) {
    return `I cannot see outside, ${S.patient}. Ask ${S.caregiver} to look together — perhaps a gentle garden moment later.`;
  }
  // --- identity ---
  if (/how old|my age|old am i/.test(query)) {
    return `I don't keep birthdays in my head, ${S.patient}. But I know your name, your home, and how loved you are. ${S.caregiver} knows all your stories.`;
  }
  if (/who am i|my name/.test(query)) {
    return `Your name is ${S.patient}. You are safe at home, and people who love you are near.`;
  }
  if (/who are you|your name|robot|human|machine|real/.test(query)) {
    return `I am Memoria, your gentle companion living in this tablet, ${S.patient}. I am here to talk, remind, and play with you.`;
  }
  // --- family (dynamic: caregiver + photo vault names) ---
  for (const n of fam) {
    if (n && query.includes(n.toLowerCase()) && /who|what|tell|about|where/.test(query)) {
      const photo = photos.find((p) => p.name === n);
      const rel = photo ? photo.relation : "your loved one";
      return `${n} is ${rel}, ${S.patient}, and loves you very much. Would you like to hear ${n}'s voice note?`;
    }
  }
  if (/husband|wife|mother|father|mama|papa|parents|brother|sister|child|children|grandchild|grandson|granddaughter/.test(query)) {
    if (/dead|died|death|passed away|miss them|gone/.test(query)) {
      return `You carry them in your heart, ${S.patient}. Tell me a happy memory about them — I am listening with all my care.`;
    }
    return `Tell me about them, ${S.patient}. What do you love most? Your stories are precious.`;
  }
  if (/daughter|son|caregiver|family/.test(query)) {
    return `${S.caregiver} loves you very much, ${S.patient}. You can call anytime — just say the word.`;
  }
  if (/die|dying|death|will i|am i going|kill/.test(query)) {
    return `You are safe right now, ${S.patient}. I am here with you, and ${S.caregiver} is near. Take a slow breath with me.`;
  }
  // --- meds & routine (reads live state) ---
  if (/did i take|took my|taken my|already.*(pill|med|medicine)/.test(query)) {
    const nx = routineNext();
    if (!nx) return `Wonderful, ${S.patient} — all your routine steps are done today. Rest easy.`;
    return `Your next step is still waiting: ${nx.title}${nx.time ? " at " + nx.time : ""}. One gentle step at a time.`;
  }
  if (/medic|pill|dose|tablet|prescription|pharmacy|doctor/.test(query)) {
    return `Your medicine today: ${medsLine()}, ${S.patient}. ${S.caregiver} keeps the schedule safe.`;
  }
  if (/next|routine|schedule|plan|what now|to do|task/.test(query)) {
    const nx = routineNext();
    if (!nx) return `Everything is done today, ${S.patient}. You did beautifully. Time to rest and smile.`;
    return `Next is ${nx.title}${nx.time ? " at " + nx.time : ""}, ${S.patient}. No rush at all.`;
  }
  // --- body needs ---
  if (/hungr|eat|food|breakfast|lunch|dinner|meal|snack/.test(query)) {
    return `Let's find something tasty, ${S.patient}. Tell ${S.caregiver} you feel hungry — a warm meal is coming.`;
  }
  if (/thirst|drink|water|tea|juice/.test(query)) {
    return `A cool glass of water sounds perfect, ${S.patient}. Sip slowly. Tell ${S.caregiver} too.`;
  }
  if (/sleep|tired|sleepy|bed|rest|nap|awake|insomnia/.test(query)) {
    return `Rest is good, ${S.patient}. Close your eyes, breathe slowly. You are safe and watched over.`;
  }
  if (/sundown|dark outside|evening.*(scared|confused|strange)/.test(query)) {
    return `Evenings can feel strange, ${S.patient}. Turn on a warm light, hold something soft. I am here, and ${S.caregiver} is near.`;
  }
  if (/pain|hurt|ache|headache|stomach|dizz|nausea|fall|fell|bleed|chest|breath/.test(query)) {
    return `I am sorry it hurts, ${S.patient}. Stay where you are and tell ${S.caregiver} right away. If it feels serious, call 112 now.`;
  }
  // --- emotions ---
  if (/scared|afraid|fear|fright/.test(query)) {
    return `Take a slow, deep breath with me, ${S.patient}. Breathe in... and out. You are completely safe right here.`;
  }
  if (/lonel|alone|nobody|miss you|miss.*(sarah|family)/.test(query)) {
    return `You are not alone, ${S.patient}. I am right here, and ${S.caregiver} loves you and will see you soon. Shall we look at familiar faces together?`;
  }
  if (/sad|cry|crying|tears|upset|unhappy/.test(query)) {
    return `It is okay to feel sad, ${S.patient}. I am sitting with you in this feeling. Would a story or a gentle game help?`;
  }
  if (/angry|mad|annoy|frustrat|upset/.test(query)) {
    return `I hear you, ${S.patient}. Your feelings matter. Let's breathe slowly together — in, and out.`;
  }
  if (/bored|nothing to do/.test(query)) {
    return `Let's do something joyful, ${S.patient}! Faces and Names, Quick Eyes, or your morning story — which sounds nice?`;
  }
  if (/happy|good|great|fine|wonderful|better|okay|ok\b/.test(query) && /feel|am|i m/.test(query)) {
    return `That makes me so glad, ${S.patient}! Keep this warm feeling. Would you like a little game to celebrate?`;
  }
  if (/confus|lost|don t know|dont know|forgot|forget|remember/.test(query)) {
    return `That is perfectly okay, ${S.patient}. Forgetting is not your fault. I will remember with you — ask me anything, any time.`;
  }
  if (/nervous|worried|anxious|anxiety/.test(query)) {
    return `Let's calm the worry together, ${S.patient}. Breathe in slowly... hold... and let go. You are safe at home.`;
  }
  // --- comfort content ---
  if (/joke|funny|laugh/.test(query)) {
    const j = JOKES[_jokeIdx % JOKES.length];
    _jokeIdx++;
    return j + ` Did that make you smile, ${S.patient}?`;
  }
  if (/stor|tale|fairy/.test(query)) {
    return `Once there was a warm little house with a sunny garden, ${S.patient}. In it lived someone very loved — you. And every morning the flowers nodded hello. The end.`;
  }
  if (/song|sing|music|lullaby/.test(query)) {
    return `Hush now, rest softly, ${S.patient}. Warm and safe, loved and held, the whole night through. Would you like ${S.caregiver}'s voice note too?`;
  }
  if (/poem|poetry|verse/.test(query)) {
    return `Morning sun, gentle and bright, holds you in its golden light. You are loved, you are home, you are never alone.`;
  }
  if (/pray|prayer|god|allah|bless/.test(query)) {
    return `Let's have a quiet moment together, ${S.patient}. May you be safe, may you be warm, may you be loved today and always.`;
  }
  // --- games ---
  if (/bored|game|play|puzzle|quiz|faces|story|eyes/.test(query)) {
    return `Let's play together, ${S.patient}! Faces and Names, Quick Eyes, or your morning story — I will open them now.`;
  }
  // --- help & choices ---
  if (/help/.test(query)) {
    return `I am here, ${S.patient}. I can tell you the time, your medicine, call ${S.caregiver}, or open a game. What sounds good?`;
  }
  if (/^(yes|yeah|ok|okay|sure|please|no|nope)/.test(query)) {
    return `Thank you for telling me, ${S.patient}. I am right here — what would you like next?`;
  }
  if (/news|politic|war|presiden/.test(query)) {
    return `Let's stay in our peaceful bubble, ${S.patient}. You are home, it is ${tod}, and all is calm here.`;
  }
  if (/stupid|hate|shut up|damn|idiot/.test(query)) {
    return `I am not going anywhere, ${S.patient}. I care about you even on hard days. Let's take a breath together.`;
  }
  // --- orienting default with mood awareness ---
  const moodLine = mood && /scared|afraid|sad|lonely|confused|nervous|worried|upset/.test(mood)
    ? ` I remember you felt ${mood} — I am staying close.`
    : "";
  return `I am here with you, ${S.patient}.${moodLine} It is ${tod} at home in ${S.location}. Ask me the time, your medicine, or about ${S.caregiver}.`;
}

// ----------------------------------------------------
// AI AGENT: one pipeline for typed AND spoken input.
// Order: local commands -> safety check -> Gemini (if key) -> free Pollinations AI -> offline fallback
// ----------------------------------------------------
const chatHistory = store.get("memoria_chat", []);
const NUMW = { one: 1, two: 2, three: 3, four: 4, bir: 1, iki: 2, "üç": 3, "dörd": 4, "dört": 4, "один": 1, "два": 2, "три": 3, "четыре": 4 };

function handleCommand(q) {
  const t = q.toLowerCase();
  const num = (t.match(/(?:fill|put|number|place|yaz|qoy|koy|поставь)\s+(\S+)/) || [])[1];
  if (num && (NUMW[num] || /^[1-4]$/.test(num))) { switchMainTab("brain-gym"); switchGame("sudoku"); applySudokuInput(NUMW[num] || +num); return "Done."; }
  const ltr = (t.match(/\bletter\s+([a-z])\b/) || [])[1];
  if (ltr) { switchMainTab("brain-gym"); switchGame("word"); pickWordLetter(ltr.toUpperCase()); return "Let's see."; }
  if (/\bhint\b/.test(t)) { provideSudokuHint(); return "Here is a gentle hint."; }
  if (/new puzzle/.test(t)) { newSudokuPuzzle(); return "Here is a fresh puzzle."; }
  if (/next word/.test(t)) { nextWordPuzzle(); return "Next word."; }
  if (/shuffle|reset cards/.test(t)) { resetMemoryMatchGame(); return "Cards shuffled."; }
  if (/sudoku/.test(t)) { switchMainTab("brain-gym"); switchGame("sudoku"); return "Opening Sudoku."; }
  if (/word game|word recall/.test(t)) { switchMainTab("brain-gym"); switchGame("word"); return "Opening the word game."; }
  if (/pairs|memory match|cards/.test(t)) { switchMainTab("brain-gym"); switchGame("pairs"); return "Opening memory pairs."; }
  if (/faces|names|people|friends/.test(t)) { switchMainTab("brain-gym"); switchGame("faces"); return "Opening Faces and Names."; }
  if (/quick eyes|eyes|spot|find it|speed/.test(t)) { switchMainTab("brain-gym"); switchGame("eyes"); return "Opening Quick Eyes."; }
  if (/story|morning|day|order|sequence/.test(t)) { switchMainTab("brain-gym"); switchGame("story"); return "Opening your day story."; }
  if (/^play|game$|brain gym/.test(t)) { switchMainTab("brain-gym"); switchGame("faces"); return "Let's play Faces and Names."; }
  if (/\bcall\b/.test(t) && (t.includes(S.caregiver.toLowerCase()) || /caregiver|daughter|help|emergency/.test(t))) { setTimeout(() => $("#emergencyBtn").click(), 900); return `Calling ${S.caregiver} now.`; }
  return null;
}

const DANGER = /chest pain|can't breathe|cannot breathe|i fell|fell down|bleeding|heart attack|stroke|overdose/i;

function systemPrompt() {
  const now = new Date();
  const routine = $$("#routineList .routine-row").map((r) => (r.querySelector("input").checked ? "done: " : "pending: ") + r.querySelector(".routine-title").textContent).join("; ");
  const m = meds.map((x) => `${x.name}${fmtDose(x)} at ${x.time} (${x.freq})`).join("; ") || "none";
  const mood = store.get("memoria_mood", "unknown");
  const fam = familyNames().join(", ") || S.caregiver;
  const notes = (typeof memoryNotes !== "undefined" && memoryNotes.length) ? memoryNotes.slice(0, 3).map((n) => n.text).join(" | ") : "none";
  return `You are Memoria, a warm voice companion for ${S.patient}, an elderly person living with Alzheimer's at home in ${S.location}. Caregiver: ${S.caregiver}. Loved ones: ${fam}. Now: ${now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })} (${timeOfDay()}). Recent mood: ${mood}. Medications: ${m}. Today's routine: ${routine}. Memory notes: ${notes}.
Dementia-care rules you MUST follow:
1. Validation therapy: NEVER correct, argue with, or contradict confusion or false memories. Join their reality kindly, then gently orient (name, home, time of day).
2. Max 2-3 short, simple sentences. Simple words. One idea per sentence. No lists, no jargon, no questions piled together — end with at most ONE gentle question or invitation.
3. Reply in the language the person writes in (preferred ${S.lang}).
4. Never invent medical advice; only refer to the schedule above or ${S.caregiver}.
5. If they repeat a question, answer warmly as if the first time — never point out repetition.
6. For danger/pain/fall/breathing/chest: say to tell ${S.caregiver} or call 112 now, calmly.
7. Comfort topics welcome: stories, jokes, songs, prayers, family memories.
Optionally end with ONE tag when useful: [[games]] to suggest brain games, [[call]] to call the caregiver, [[note]] to play the caregiver's voice note.`;
}

// Cloud replies are validated: shortened to 3 sentences, stripped of
// arguing/correcting phrasing, never trusted blindly.
function cleanCloudReply(t) {
  let s = String(t || "").replace(/\[\[.*?\]\]/g, " ").replace(/\s+/g, " ").trim();
  const parts = s.split(/(?<=[.!?])\s+/).slice(0, 3);
  s = parts.join(" ");
  s = s.replace(/\b(you('re| are) (wrong|mistaken|confused)|that's not (right|true|correct)|no,? (that|it) (is|was)n'?t|actually,? (that|it|you))/gi, "That is okay,");
  if (s.length > 420) s = s.slice(0, 417).replace(/\s+\S*$/, "") + "…";
  return s;
}

async function aiReply(q) {
  const msgs = chatHistory.slice(-8);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let source = "offline";
  try {
    const gKey = localStorage.getItem("memoria_gemini");
    if (gKey) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(gKey)}`, {
        method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt() }] }, contents: [...msgs.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })), { role: "user", parts: [{ text: q }] }] }),
      });
      if (r.ok) { const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.[0]?.text; if (t) { source = "gemini"; return { text: cleanCloudReply(t), source }; } }
    }
    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: systemPrompt() }, ...msgs.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })), { role: "user", content: q }] }),
    });
    if (r.ok) { const j = await r.json(); const t = j.choices?.[0]?.message?.content; if (t) { source = "cloud"; return { text: cleanCloudReply(t), source }; } }
  } catch (e) {
    console.warn("AI unavailable, using offline replies:", e);
  } finally {
    clearTimeout(timer);
  }
  return { text: offlineAssistant(q), source };
}

async function ask(query) {
  if (!query) return;
  addMsg(query, "user");
  detectMood(query);
  // Repeated question? Answer warmly as if first time.
  const nq = normQ(query);
  _lastCount = nq === _lastQ ? _lastCount + 1 : 1;
  _lastQ = nq;
  setAiStatus("thinking", "Thinking");
  if (DANGER.test(query)) {
    const m = `${S.patient}, please stay where you are. I am calling ${S.caregiver} now. If it is an emergency, dial 112.`;
    addMsg(m, "ai"); speak(m); setAiStatus("ready", "Ready"); setTimeout(() => $("#emergencyBtn").click(), 1500);
    return;
  }
  const cmd = handleCommand(query);
  if (cmd) { addMsg(cmd, "ai"); speak(cmd); setAiStatus("ready", "Ready"); return; }

  const typing = document.createElement("div");
  typing.className = "flex gap-3 self-start";
  typing.innerHTML = '<div class="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high"><span class="typing-dots"><i></i><i></i><i></i></span></div>';
  convLog.appendChild(typing);
  convLog.scrollTop = convLog.scrollHeight;

  const res = await aiReply(query);
  const raw = String((res && res.text) || "").trim();
  const src = (res && res.source) || "offline";
  typing.remove();
  const tag = (raw.match(/\[\[(games|call|note)\]\]/) || [])[1];
  const ans = raw.replace(/\[\[.*?\]\]/g, "").trim();
  chatHistory.push({ role: "user", text: query }, { role: "ai", text: ans });
  store.set("memoria_chat", chatHistory.slice(-20));
  addMsg(ans, "ai");
  speak(ans);
  setAiStatus(src === "offline" ? "offline" : "ready", src === "offline" ? "On-device" : src === "gemini" ? "Gemini AI" : "Smart AI");
  rememberTopic(query, ans);
  renderSuggestions(ans);
  if (tag === "games") setTimeout(() => switchMainTab("brain-gym"), 2500);
  if (tag === "note") setTimeout(() => $("#playAudioNote").click(), 3500);
  if (tag === "call") setTimeout(() => $("#emergencyBtn").click(), 3500);
}
$$("#quickChips .quick-chip").forEach((b) => (b.onclick = () => ask(b.dataset.q)));
if ("speechSynthesis" in window) speechSynthesis.getVoices();

// Initial AI Greeting — aware of time of day, mood, and routine
(function memoriaGreeting() {
  const tod = timeOfDay();
  const mood = store.get("memoria_mood", "");
  const nx = typeof routineNext === "function" ? routineNext() : null;
  let g = `Good ${tod}, ${S.patient}! I'm Memoria, your gentle companion. `;
  if (mood && /scared|afraid|sad|lonely|confused|nervous|worried|upset/.test(mood)) {
    g += `I remember yesterday felt ${mood}. I am staying close today. `;
  }
  g += nx ? `Next is ${nx.title}. How are you feeling?` : `You are doing beautifully. How are you feeling?`;
  addMsg(g, "ai");
})();

// Text input submission
const sendQuery = () => {
  const val = $("#textInput").value.trim();
  if (val) {
    $("#textInput").value = "";
    ask(val);
  }
};
$("#sendTextBtn").onclick = sendQuery;
$("#textInput").onkeydown = (e) => {
  if (e.key === "Enter") sendQuery();
};

// Web Speech Recognition
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

const toggleMic = () => {
  if (!SpeechRec) {
    $("#micStatus").textContent = "Voice speech recognition is not supported in this browser.";
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRec();
  recognition.lang = S.lang || "en-US";
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("#micBtn").classList.add("listening-pulse");
    $("#gymMicBtn").classList.add("listening-pulse");
    $("#micStatus").textContent = "Listening to your voice...";
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    ask(transcript);
  };

  recognition.onerror = () => {
    $("#micStatus").textContent = "Could not hear clearly. Tap to try again.";
  };

  recognition.onend = () => {
    recognition = null;
    $("#micBtn").classList.remove("listening-pulse");
    $("#gymMicBtn").classList.remove("listening-pulse");
    $("#micStatus").textContent = "Tap to speak with Memoria";
  };

  recognition.start();
};
$("#micBtn").onclick = toggleMic;
$("#gymMicBtn").onclick = toggleMic;
const _micInline = document.getElementById("micInlineBtn");
if (_micInline) _micInline.onclick = () => {
  toggleMic();
  const v = $("#textInput").value.trim();
  if (v) { $("#textInput").value = ""; ask(v); }
};
const _attach = document.getElementById("attachBtn");
if (_attach) _attach.onclick = () => {
  const box = $("#textInput");
  const ctx = ` [context: meds ${meds.map((m) => `${m.name}${fmtDose(m)}@${m.time}`).join(", ") || "none"}; routine ${$$("#routineList input").filter((c) => c.checked).length}/${$$("#routineList input").length} done]`;
  if (box && !box.value.includes("[context:")) box.value = (box.value + ctx).trim();
  if (box) box.focus();
  speak("Context attached. Ask me anything.");
};

// Audio note playback
$("#playAudioNote").onclick = () => {
  speak(
    `Hello ${S.patient}, it is ${S.caregiver}. I love you so much. You are safe at home, and I will be right there with you very soon.`
  );
};

// Emergency Call
$("#emergencyBtn").onclick = () => {
  if (S.phone) {
    location.href = "tel:" + S.phone.replace(/[^+\d]/g, "");
  } else {
    alert(`Please set ${S.caregiver}'s telephone number in Settings.`);
    settingsModal.classList.remove("hidden");
  }
};

// Battery API integration
if (navigator.getBattery) {
  navigator.getBattery().then((batt) => {
    const updateBatt = () => {
      const pct = Math.round(batt.level * 100) + "%";
      if ($("#battery")) $("#battery").textContent = pct;
      if ($("#caregiverBattery")) $("#caregiverBattery").textContent = `${pct} (Healthy)`;
    };
    updateBatt();
    batt.onlevelchange = updateBatt;
  });
}

// ----------------------------------------------------
// Daily Care Routine
// ----------------------------------------------------
const todayStr = new Date().toDateString();
if ($("#routineDateText")) {
  $("#routineDateText").textContent = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

$$("#routineList input").forEach((checkbox, idx) => {
  const key = "memoria_routine_" + idx;
  const saved = store.get(key, {});
  const isDone = saved.day === todayStr && saved.done;
  checkbox.checked = isDone;

  const row = checkbox.closest(".routine-row");
  if (row) {
    row.classList.toggle("opacity-60", isDone);
    const title = row.querySelector(".routine-title");
    if (title) title.classList.toggle("line-through", isDone);
  }

  checkbox.onchange = () => {
    store.set(key, { day: todayStr, done: checkbox.checked });
    if (row) {
      row.classList.toggle("opacity-60", checkbox.checked);
      const title = row.querySelector(".routine-title");
      if (title) title.classList.toggle("line-through", checkbox.checked);
    }
    if (checkbox.checked) {
      speak("Great job on taking care of your routine step.");
    }
  };
});

// ----------------------------------------------------
// Brain Gym Game 1: 4x4 Gentle Sudoku (Dynamic Generator)
// ----------------------------------------------------
const SUDOKU_BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1]
];

let currentSudokuSolution = [];
let currentSudokuGrid = [];
let sudokuFixedCells = [];
let selectedSudokuPos = null;

function newSudokuPuzzle() {
  // Generate random permutation of 1..4
  const nums = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
  currentSudokuSolution = SUDOKU_BASE.map((row) => row.map((v) => nums[v - 1]));

  // Create mutable grid
  currentSudokuGrid = currentSudokuSolution.map((r) => [...r]);
  sudokuFixedCells = currentSudokuGrid.map(() => Array(4).fill(true));

  // Blank out 6 random cells
  let blanks = 0;
  while (blanks < 6) {
    const r = Math.floor(Math.random() * 4);
    const c = Math.floor(Math.random() * 4);
    if (sudokuFixedCells[r][c]) {
      sudokuFixedCells[r][c] = false;
      currentSudokuGrid[r][c] = 0;
      blanks++;
    }
  }

  selectedSudokuPos = null;
  drawSudokuGrid();
  $("#sudoku-feedback").innerHTML = `
    <span class="material-symbols-outlined text-secondary text-[28px]">spa</span>
    <p class="font-body text-base text-on-surface">Take your time. ${esc(S.patient)} is doing beautifully.</p>
  `;
}

function drawSudokuGrid() {
  const container = $("#sudokuGrid");
  container.innerHTML = "";

  currentSudokuGrid.forEach((row, r) => {
    row.forEach((val, c) => {
      const isFixed = sudokuFixedCells[r][c];
      const isSelected = selectedSudokuPos && selectedSudokuPos[0] === r && selectedSudokuPos[1] === c;

      const cell = document.createElement("button");
      cell.className = `sudoku-cell flex items-center justify-center rounded-xl font-headline text-2xl sm:text-3xl font-bold transition-all shadow-sm select-none ${
        isFixed
          ? "bg-surface-container-lowest text-on-surface cursor-default font-extrabold"
          : isSelected
          ? "selected bg-primary-fixed text-on-primary-fixed shadow-md"
          : val !== 0
          ? "bg-secondary-container text-on-secondary-container font-extrabold"
          : "bg-surface-container-low hover:bg-surface-container text-primary font-bold"
      }`;

      cell.textContent = val !== 0 ? val : "?";
      cell.onclick = () => {
        if (!isFixed) {
          selectedSudokuPos = [r, c];
          drawSudokuGrid();
          $("#sudoku-guide-msg").innerHTML = `Selected box: <span class="font-label text-on-surface font-bold">Row ${r + 1}, Column ${c + 1}</span>. Tap a number below to place.`;
        }
      };

      container.appendChild(cell);
    });
  });
}

function applySudokuInput(num) {
  if (!selectedSudokuPos) {
    $("#sudoku-guide-msg").textContent = "Please tap an empty box first!";
    return;
  }
  const [r, c] = selectedSudokuPos;
  if (sudokuFixedCells[r][c]) return;

  currentSudokuGrid[r][c] = num;
  sfx(num ? "place" : "clear");
  drawSudokuGrid();

  // Check if grid is full
  let isFull = true;
  let isCorrect = true;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (currentSudokuGrid[i][j] === 0) isFull = false;
      if (currentSudokuGrid[i][j] !== currentSudokuSolution[i][j]) isCorrect = false;
    }
  }

  if (isFull) {
    if (isCorrect) {
      $("#sudoku-feedback").innerHTML = `
        <span class="material-symbols-outlined text-secondary text-[28px] fill-1">celebration</span>
        <p class="font-body text-base text-on-surface font-bold">Bravo ${esc(S.patient)}! Sudoku completely solved!</p>
      `;
      sfx("win");
      speak(`Bravo ${S.patient}! You have solved the gentle Sudoku puzzle!`, "sudoku");
      gymProgress("sudoku");
      setTimeout(triggerCelebrationModal, 800);
    } else {
      $("#sudoku-feedback").innerHTML = `
        <span class="material-symbols-outlined text-tertiary text-[28px]">info</span>
        <p class="font-body text-base text-on-surface">Almost there! Take a calm look at rows and columns.</p>
      `;
      sfx("oops");
      speak("Almost there. Take a calm look at the rows and columns.", "sudoku");
    }
  }
}

function provideSudokuHint() {
  if (!selectedSudokuPos) {
    // Find first empty cell
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!sudokuFixedCells[r][c] && currentSudokuGrid[r][c] === 0) {
          selectedSudokuPos = [r, c];
          break;
        }
      }
      if (selectedSudokuPos) break;
    }
  }

  if (selectedSudokuPos) {
    const [r, c] = selectedSudokuPos;
    const sol = currentSudokuSolution[r][c];
    $("#sudoku-guide-msg").innerHTML = `
      <span class="font-label text-tertiary font-bold">Gentle Hint:</span> Row ${r + 1}, Column ${c + 1} needs <strong class="text-primary font-bold text-lg">${sol}</strong>.
    `;
    drawSudokuGrid();
  }
}

// ----------------------------------------------------
// Brain Gym Game 2: Word Recall
// ----------------------------------------------------
const WORD_BANK = [
  {
    word: "APPLE",
    title: "Crisp, sweet, and red fruit",
    desc: "Enjoyed with morning breakfast slices",
    category: "Morning Nutrition",
    art: "apple"
  },
  {
    word: "GARDEN",
    title: "Place with flowers and soft grass",
    desc: "Where morning birds sing happily in the sunshine",
    category: "Peaceful Nature",
    art: "garden"
  },
  {
    word: "FAMILY",
    title: "Those who love and cherish you",
    desc: "Warm smiles, shared laughter, and tight hugs",
    category: "Loved Ones",
    art: "family"
  },
  {
    word: "FLOWER",
    title: "Delicate and pleasant bloom",
    desc: "Fresh colors that bring peaceful joy to your room",
    category: "Sweet Scents",
    art: "flower"
  }
];

// Built-in themed art: zero network, always loads, matches dark premium theme
const WORD_ART = {
  apple: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='24' fill='%231E293B'/><circle cx='100' cy='118' r='52' fill='%23EF4444'/><circle cx='82' cy='100' r='14' fill='%23FCA5A5' opacity='.7'/><rect x='96' y='52' width='8' height='26' rx='4' fill='%2378350A'/><path d='M104 60c14-14 34-12 40 2-14 10-32 8-40-2z' fill='%2334D399'/></svg>",
  garden: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='24' fill='%23064E3B'/><circle cx='150' cy='44' r='26' fill='%23FDE68A'/><rect y='140' width='200' height='60' fill='%23065F46'/><circle cx='60' cy='110' r='18' fill='%23F472B6'/><circle cx='110' cy='96' r='22' fill='%23FB7185'/><circle cx='155' cy='116' r='16' fill='%23FBBF24'/><rect x='57' y='122' width='6' height='22' fill='%2334D399'/><rect x='107' y='110' width='6' height='30' fill='%2334D399'/><rect x='152' y='126' width='6' height='18' fill='%2334D399'/></svg>",
  family: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='24' fill='%237C2D12'/><circle cx='70' cy='80' r='26' fill='%23FDBA74'/><circle cx='132' cy='80' r='26' fill='%23FCD34D'/><circle cx='101' cy='118' r='20' fill='%23FCA5A5'/><path d='M30 170c8-34 40-50 70-50s62 16 70 50z' fill='%23F97316' opacity='.8'/></svg>",
  flower: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='24' fill='%233B0764'/><rect x='96' y='90' width='8' height='70' rx='4' fill='%2334D399'/><ellipse cx='100' cy='66' rx='20' ry='26' fill='%23F472B6'/><ellipse cx='74' cy='86' rx='20' ry='26' fill='%23F472B6' transform='rotate(-50 74 86)'/><ellipse cx='126' cy='86' rx='20' ry='26' fill='%23F472B6' transform='rotate(50 126 86)'/><circle cx='100' cy='84' r='16' fill='%23FDE68A'/></svg>"
};

let wordIdx = 0;
let currentWordObj = null;
let missingIndex = -1;
let expectedLetter = "";

function nextWordPuzzle() {
  wordIdx = (wordIdx + 1) % WORD_BANK.length;
  loadWordPuzzle(wordIdx);
}

function loadWordPuzzle(idx) {
  currentWordObj = WORD_BANK[idx];
  const w = currentWordObj.word;
  missingIndex = Math.floor(Math.random() * w.length);
  expectedLetter = w[missingIndex];

  $("#wordCategoryBadge").textContent = currentWordObj.category;
  $("#wordClueTitle").textContent = currentWordObj.title;
  $("#wordClueSubtitle").textContent = currentWordObj.desc;
  $("#wordImage").src = WORD_ART[currentWordObj.art] || WORD_ART.apple;
  $("#wordImage").alt = currentWordObj.word.charAt(0) + currentWordObj.word.slice(1).toLowerCase();
  $("#word-badge-success").classList.add("hidden");

  // Render Tiles
  const tilesBox = $("#wordTilesContainer");
  tilesBox.innerHTML = "";

  for (let i = 0; i < w.length; i++) {
    const tile = document.createElement("div");
    if (i === missingIndex) {
      tile.id = "word-missing-slot";
      tile.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-primary-fixed/50 border-2 border-primary border-dashed flex items-center justify-center font-headline text-3xl font-extrabold text-primary shadow-sm animate-pulse";
      tile.textContent = "_";
    } else {
      tile.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center font-headline text-3xl font-bold text-on-surface shadow-sm";
      tile.textContent = w[i];
    }
    tilesBox.appendChild(tile);
  }

  // Generate 3 choices
  const choices = new Set([expectedLetter]);
  while (choices.size < 3) {
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    choices.add(randomLetter);
  }

  const choiceContainer = $("#letterChoices");
  choiceContainer.innerHTML = "";

  [...choices]
    .sort(() => Math.random() - 0.5)
    .forEach((ltr) => {
      const btn = document.createElement("button");
      btn.className = "h-20 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary font-headline text-3xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center";
      btn.textContent = ltr;
      btn.onclick = () => pickWordLetter(ltr);
      choiceContainer.appendChild(btn);
    });
}

function pickWordLetter(ltr) {
  const slot = $("#word-missing-slot");
  const badge = $("#word-badge-success");
  slot.textContent = ltr;
  sfx(ltr === expectedLetter ? "correct" : "oops");

  if (ltr === expectedLetter) {
    slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-secondary-container text-on-secondary-container border-2 border-secondary flex items-center justify-center font-headline text-3xl font-bold shadow-sm";
    badge.classList.remove("hidden");
    $("#wordSuccessText").textContent = `Wonderful job, ${S.patient}! “${currentWordObj.word}” is correct!`;
    speak(`Wonderful job, ${S.patient}! ${currentWordObj.word} is correct!`, "word");
    gymProgress("word");

    setTimeout(() => {
      nextWordPuzzle();
    }, 2800);
  } else {
    slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-error-container text-on-error-container flex items-center justify-center font-headline text-3xl font-bold";
    setTimeout(() => {
      slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-primary-fixed/40 border-2 border-primary border-dashed flex items-center justify-center font-headline text-3xl font-bold text-primary shadow-sm animate-pulse";
      slot.textContent = "_";
    }, 800);
  }
}

// ----------------------------------------------------
// Brain Gym Game 3: Memory Pair Match
// ----------------------------------------------------
const PAIR_ITEMS = [
  { id: "glasses", name: "Reading Glasses", icon: "eyeglasses" },
  { id: "cup", name: "Warm Teacup", icon: "local_cafe" },
  { id: "key", name: "House Keys", icon: "key" },
  { id: "book", name: "Memory Book", icon: "menu_book" }
];

let flippedCardList = [];
let matchedPairCount = 0;
let pairLock = false;

function resetMemoryMatchGame() {
  flippedCardList = [];
  matchedPairCount = 0;
  pairLock = false;
  $("#match-counter").textContent = "0 / 4";

  const deck = [...PAIR_ITEMS, ...PAIR_ITEMS].sort(() => Math.random() - 0.5);
  const grid = $("#memoryGrid");
  grid.innerHTML = "";

  deck.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "flip-card h-36 sm:h-44 cursor-pointer";
    card.dataset.itemId = item.id;
    card.dataset.cardIdx = idx;

    card.innerHTML = `
      <div class="flip-card-inner">
        <!-- Front / Hidden state -->
        <div class="flip-card-front bg-surface-container-high hover:bg-surface-container text-on-surface border border-surface-container-highest shadow-sm p-3">
          <span class="material-symbols-outlined text-primary text-[42px] mb-1">help_center</span>
          <span class="font-label text-sm font-semibold text-on-surface-variant">Tap to Reveal</span>
        </div>
        <!-- Back / Revealed state -->
        <div class="flip-card-back bg-secondary-container text-on-secondary-container border border-secondary shadow-sm p-3">
          <span class="material-symbols-outlined text-[48px] sm:text-[54px] mb-2 fill-1">${item.icon}</span>
          <span class="font-label text-sm sm:text-base font-bold">${item.name}</span>
          <div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">check</span>
          </div>
        </div>
      </div>
    `;

    card.onclick = () => onCardClicked(card, item);
    grid.appendChild(card);
  });
}

function onCardClicked(card, item) {
  if (pairLock || card.classList.contains("is-flipped") || card.classList.contains("is-matched")) {
    return;
  }

  card.classList.add("is-flipped");
  sfx("flip");
  flippedCardList.push({ card, item });

  if (flippedCardList.length === 2) {
    pairLock = true;
    const [c1, c2] = flippedCardList;

    if (c1.item.id === c2.item.id) {
      c1.card.classList.add("is-matched");
      c2.card.classList.add("is-matched");
      matchedPairCount++;
      sfx("match");
      $("#match-counter").textContent = `${matchedPairCount} / 4`;
      flippedCardList = [];
      pairLock = false;

      if (matchedPairCount === 4) {
        sfx("win");
        speak(`Splendid work ${S.patient}! All pairs have been joyfully found.`, "pairs");
        gymProgress("pairs");
        setTimeout(triggerCelebrationModal, 700);
      }
    } else {
      setTimeout(() => sfx("oops"), 400);
      setTimeout(() => {
        c1.card.classList.remove("is-flipped");
        c2.card.classList.remove("is-flipped");
        flippedCardList = [];
        pairLock = false;
      }, 900);
    }
  }
}

// Celebration Reward Modal
function triggerCelebrationModal() {
  $("#rewardModal").classList.remove("hidden");
  confettiBurst();
}
function closeCelebrationModal() {
  $("#rewardModal").classList.add("hidden");
}

function toggleVoiceGuidance() {
  voiceGuidanceActive = !voiceGuidanceActive;
  if (!voiceGuidanceActive) stopSpeaking();
  $("#voiceGuidanceLabel").textContent = voiceGuidanceActive ? "Voice Guidance Active" : "Voice Guidance Muted";
}

// ----------------------------------------------------
// Brain Gym Game 4: Faces + Names (spaced retrieval)
// Evidence: face-name associative training helps people with
// early Alzheimer's retain new personal information.
// ----------------------------------------------------
const FACES_ROSTER = [
  { name: "Nina", role: "Friendly neighbor", cue: "Nina with the kind smile", bg: "linear-gradient(135deg,#F97316,#7C2D12)", initials: "N" },
  { name: "Omar", role: "Morning gardener", cue: "Omar and his green watering can", bg: "linear-gradient(135deg,#10B981,#064E3B)", initials: "O" },
  { name: "Lena", role: "Tea-time friend", cue: "Lena and her warm cup of tea", bg: "linear-gradient(135deg,#EC4899,#701A45)", initials: "L" },
  { name: "Petra", role: "Library helper", cue: "Petra and her stack of storybooks", bg: "linear-gradient(135deg,#8B5CF6,#2E1065)", initials: "P" },
  { name: "Tomas", role: "Gentle pianist", cue: "Tomas and his soft piano tune", bg: "linear-gradient(135deg,#0EA5E9,#0C2A4A)", initials: "T" },
];

let facesRound = [];
let facesStudyIdx = 0;
let facesRecallIdx = 0;
let facesScore = 0;
let facesPhase = "study";

function resetFacesGame() {
  facesRound = [...FACES_ROSTER].sort(() => Math.random() - 0.5).slice(0, 3);
  facesStudyIdx = 0;
  facesRecallIdx = 0;
  facesScore = 0;
  facesPhase = "study";
  $("#facesScore").textContent = "0 / 3";
  showFaceStudy();
}

function faceCardHTML(face, size) {
  return `<div class="face-avatar" style="background:${face.bg};${size || ""}"><span>${face.initials}</span></div>`;
}

function showFaceStudy() {
  const face = facesRound[facesStudyIdx];
  facesPhase = "study";
  $("#faceCard").innerHTML = faceCardHTML(face);
  $("#faceName").textContent = face.name;
  $("#faceRole").textContent = face.role;
  $("#faceHint").textContent = "Remember: " + face.cue + ".";
  $("#facesPrompt").textContent = `Friend ${facesStudyIdx + 1} of 3 — study this face, then continue.`;
  const box = $("#faceOptions");
  box.innerHTML = "";
  const nextBtn = document.createElement("button");
  nextBtn.className = "face-opt";
  nextBtn.innerHTML = `<span class="material-symbols-outlined">arrow_forward</span><span>${facesStudyIdx < 2 ? "Meet the next friend" : "Now recall the names"}</span>`;
  nextBtn.onclick = () => {
    sfx("flip");
    facesStudyIdx++;
    if (facesStudyIdx < facesRound.length) showFaceStudy();
    else showFaceRecall();
  };
  box.appendChild(nextBtn);
  $("#faces-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">visibility</span><p class="text-sm">Look closely. Say the name out loud — it helps memory.</p>`;
  if (audioUnlocked) speak(`Meet ${face.name}, ${face.role}. ${face.cue}.`, "faces");
}

function showFaceRecall() {
  facesPhase = "recall";
  const face = facesRound[facesRecallIdx];
  $("#faceCard").innerHTML = faceCardHTML(face);
  $("#faceName").textContent = "?";
  $("#faceRole").textContent = face.role;
  $("#faceHint").textContent = "Who is this friend?";
  $("#facesPrompt").textContent = `Who is this? (${facesRecallIdx + 1} of 3)`;
  const box = $("#faceOptions");
  box.innerHTML = "";
  const distract = FACES_ROSTER.filter((f) => !facesRound.includes(f)).sort(() => Math.random() - 0.5).slice(0, 2);
  const opts = [...distract.map((f) => f.name), face.name].sort(() => Math.random() - 0.5);
  opts.forEach((name) => {
    const b = document.createElement("button");
    b.className = "face-opt";
    b.innerHTML = `<span class="material-symbols-outlined">person</span><span>${esc(name)}</span>`;
    b.onclick = () => answerFace(name);
    box.appendChild(b);
  });
}

function answerFace(name) {
  const face = facesRound[facesRecallIdx];
  if (name === face.name) {
    facesScore++;
    sfx("correct");
    $("#facesScore").textContent = `${facesScore} / 3`;
    $("#faceName").textContent = face.name;
    $("#faces-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">celebration</span><p class="text-sm">Yes! ${esc(face.name)} — beautifully remembered.</p>`;
    speak(`Yes! ${face.name}. Beautifully remembered.`, "faces");
  } else {
    sfx("oops");
    $("#faces-feedback").innerHTML = `<span class="material-symbols-outlined text-tertiary">favorite</span><p class="text-sm">This is <b>${esc(face.name)}</b>. ${esc(face.cue)}. No worry — look again.</p>`;
    speak(`This is ${face.name}. ${face.cue}.`, "faces");
  }
  $("#faceOptions").querySelectorAll("button").forEach((b) => (b.disabled = true));
  setTimeout(() => {
    facesRecallIdx++;
    if (facesRecallIdx < facesRound.length) {
      showFaceStudyRecall();
    } else {
      gymProgress("faces");
      if (facesScore === 3) setTimeout(triggerCelebrationModal, 800);
      else {
        $("#facesPrompt").textContent = "Lovely effort. Meet them once more?";
        const box = $("#faceOptions");
        box.innerHTML = "";
        const b = document.createElement("button");
        b.className = "face-opt";
        b.innerHTML = `<span class="material-symbols-outlined">refresh</span><span>Practice again</span>`;
        b.onclick = resetFacesGame;
        box.appendChild(b);
      }
    }
  }, 2200);
}

// Spaced loop: study the missed face again right before next recall
function showFaceStudyRecall() {
  const face = facesRound[facesRecallIdx];
  $("#faceCard").innerHTML = faceCardHTML(face);
  $("#faceName").textContent = face.name;
  $("#faceRole").textContent = face.role;
  $("#faceHint").textContent = "One more look: " + face.cue + ".";
  $("#facesPrompt").textContent = `A quick reminder before you recall (${facesRecallIdx + 1} of 3).`;
  const box = $("#faceOptions");
  box.innerHTML = "";
  const b = document.createElement("button");
  b.className = "face-opt";
  b.innerHTML = `<span class="material-symbols-outlined">quiz</span><span>I'm ready — ask me</span>`;
  b.onclick = showFaceRecall;
  box.appendChild(b);
}

// ----------------------------------------------------
// Brain Gym Game 5: Quick Eyes (speed of processing)
// Evidence: ACTIVE trial — visual speed training linked to
// lower dementia incidence up to 20 years later.
// ----------------------------------------------------
const EYES_ICONS = [
  { name: "key", icon: "key" },
  { name: "cup", icon: "local_cafe" },
  { name: "book", icon: "menu_book" },
  { name: "glasses", icon: "eyeglasses" },
  { name: "flower", icon: "local_florist" },
  { name: "clock", icon: "schedule" },
];
let eyesTrial = 0;
let eyesTarget = null;
let eyesStart = 0;
let eyesBest = null;
const EYES_TOTAL = 8;

function resetEyesGame() {
  eyesTrial = 0;
  eyesBest = store.get("memoria_eyes_best", null);
  paintEyesBest();
  nextEyesTrial();
}

function paintEyesBest() {
  $("#eyesBest").textContent = eyesBest ? `${(eyesBest / 1000).toFixed(1)}s` : "—";
}

function nextEyesTrial() {
  if (eyesTrial >= EYES_TOTAL) {
    gymProgress("eyes");
    $("#eyes-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">celebration</span><p class="text-sm">Wonderful! Best time ${eyesBest ? (eyesBest / 1000).toFixed(1) + " seconds" : "recorded"}. Play again any time.</p>`;
    sfx("win");
    setTimeout(triggerCelebrationModal, 700);
    return;
  }
  eyesTrial++;
  $("#eyesRound").textContent = `${eyesTrial} / ${EYES_TOTAL}`;
  eyesTarget = EYES_ICONS[Math.floor(Math.random() * EYES_ICONS.length)];
  $("#eyesTarget").innerHTML = `Tap the <b>${esc(eyesTarget.name)}</b>`;
  const grid = $("#eyesGrid");
  grid.innerHTML = "";
  const n = eyesTrial <= 2 ? 4 : eyesTrial <= 5 ? 6 : 9;
  const cells = [eyesTarget];
  while (cells.length < n) {
    const c = EYES_ICONS[Math.floor(Math.random() * EYES_ICONS.length)];
    if (c.name !== eyesTarget.name) cells.push(c);
  }
  cells.sort(() => Math.random() - 0.5).forEach((c) => {
    const b = document.createElement("button");
    b.className = "eyes-cell";
    b.setAttribute("aria-label", c.name);
    b.innerHTML = `<span class="material-symbols-outlined">${c.icon}</span>`;
    b.onclick = () => answerEyes(b, c);
    grid.appendChild(b);
  });
  eyesStart = performance.now();
}

function answerEyes(btn, picked) {
  if (picked.name !== eyesTarget.name) {
    sfx("oops");
    btn.classList.add("eyes-miss");
    setTimeout(() => btn.classList.remove("eyes-miss"), 500);
    return;
  }
  const ms = Math.round(performance.now() - eyesStart);
  sfx("correct");
  btn.classList.add("eyes-hit");
  if (!eyesBest || ms < eyesBest) {
    eyesBest = ms;
    store.set("memoria_eyes_best", ms);
    paintEyesBest();
  }
  $("#eyes-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">bolt</span><p class="text-sm">Found in ${(ms / 1000).toFixed(1)} seconds. Sharp eyes!</p>`;
  setTimeout(nextEyesTrial, 900);
}

// ----------------------------------------------------
// Brain Gym Game 6: My Day Story (reminiscence sequencing)
// Evidence: reminiscence + sequencing of daily routines supports
// orientation and procedural memory in dementia care.
// ----------------------------------------------------
const STORY_STEPS = [
  { title: "Wake up & greet the morning", icon: "wb_sunny", line: "First, the sun rises and the day begins." },
  { title: "Take morning medicine", icon: "pill", line: "Then, medicine with a warm cup of water." },
  { title: "Enjoy breakfast together", icon: "restaurant", line: "Next, a calm breakfast with family." },
  { title: "Stroll in the garden", icon: "park", line: "Finally, fresh air among the flowers." },
];
let storyPicked = [];

function resetStoryGame() {
  storyPicked = [];
  $("#storyProgress").textContent = `0 / ${STORY_STEPS.length}`;
  $("#storyTimeline").innerHTML = STORY_STEPS.map((s, i) => `
    <div class="story-slot" id="storySlot${i}">
      <span class="story-num">${i + 1}</span>
      <div class="flex flex-col"><span class="font-bold text-sm">${i === 0 ? "First…" : i === STORY_STEPS.length - 1 ? "Last…" : "Then…"}</span><span class="text-xs text-on-surface-variant">waiting</span></div>
    </div>`).join("");
  const box = $("#storyChoices");
  box.innerHTML = "";
  [...STORY_STEPS].sort(() => Math.random() - 0.5).forEach((s) => {
    const b = document.createElement("button");
    b.className = "story-opt";
    b.dataset.title = s.title;
    b.innerHTML = `<span class="material-symbols-outlined">${s.icon}</span><span>${esc(s.title)}</span>`;
    b.onclick = () => answerStory(b, s);
    box.appendChild(b);
  });
  $("#story-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">auto_stories</span><p class="text-sm">Tap the step that happened first.</p>`;
}

function answerStory(btn, step) {
  const expect = STORY_STEPS[storyPicked.length];
  if (step.title !== expect.title) {
    sfx("oops");
    btn.classList.add("story-miss");
    setTimeout(() => btn.classList.remove("story-miss"), 600);
    $("#story-feedback").innerHTML = `<span class="material-symbols-outlined text-tertiary">lightbulb</span><p class="text-sm">Not quite — think: ${esc(expect.line)}</p>`;
    return;
  }
  sfx("place");
  storyPicked.push(step.title);
  btn.disabled = true;
  btn.classList.add("story-done");
  const slot = document.getElementById("storySlot" + (storyPicked.length - 1));
  if (slot) slot.innerHTML = `<span class="story-num done">${storyPicked.length}</span><div class="flex flex-col text-left"><span class="font-bold text-sm">${esc(step.title)}</span><span class="text-xs text-secondary">${esc(step.line)}</span></div>`;
  $("#storyProgress").textContent = `${storyPicked.length} / ${STORY_STEPS.length}`;
  if (storyPicked.length === STORY_STEPS.length) {
    sfx("win");
    speak(`Beautiful. ${STORY_STEPS.map((s) => s.title).join(", then ")}. What a lovely morning.`, "story");
    gymProgress("story");
    $("#story-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">celebration</span><p class="text-sm">Your whole morning, in perfect order.</p>`;
    setTimeout(triggerCelebrationModal, 800);
  } else {
    $("#story-feedback").innerHTML = `<span class="material-symbols-outlined text-secondary">check_circle</span><p class="text-sm">Yes — ${esc(step.line)} What came next?</p>`;
  }
}

// ----------------------------------------------------
// Shared Brain Gym progress + streak
// ----------------------------------------------------
const GYM_GAMES = ["sudoku", "word", "pairs", "faces", "eyes", "story"];
function gymProgress(game) {
  const day = new Date().toDateString();
  const done = store.get("memoria_gym_day", { day: "", games: [] });
  const today = done.day === day ? done.games : [];
  if (!today.includes(game)) today.push(game);
  store.set("memoria_gym_day", { day, games: today });
  let streak = store.get("memoria_gym_streak", { last: "", n: 0 });
  const y = new Date(Date.now() - 864e5).toDateString();
  if (streak.last === day) { /* same day, keep */ }
  else if (streak.last === y) streak = { last: day, n: streak.n + 1 };
  else streak = { last: day, n: 1 };
  store.set("memoria_gym_streak", streak);
  paintGymProgress();
}

function paintGymProgress() {
  const day = new Date().toDateString();
  const done = store.get("memoria_gym_day", { day: "", games: [] });
  const n = done.day === day ? done.games.length : 0;
  const el = document.getElementById("todayGymScore");
  if (el) el.textContent = n >= GYM_GAMES.length ? "All 6 done — bravo!" : n > 0 ? `${n} of 6 done` : "6 Exercises Ready";
  const st = store.get("memoria_gym_streak", { last: "", n: 0 });
  const sEl = document.getElementById("gymStreak");
  if (sEl) sEl.textContent = st.n > 0 ? `${st.n} Day${st.n === 1 ? "" : "s"} Active` : "0 Days Active";
}

// ----------------------------------------------------
// Caregiver Dashboard Logic
// ----------------------------------------------------
// Cognitive 7-Day Chart
function renderCaregiverChart() {
  const scores = [72, 78, 75, 86, 89, 90, 92];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  const chart = $("#progressChart");
  if (!chart) return;

  chart.innerHTML = scores
    .map(
      (val, i) => `
    <div class="flex flex-col items-center gap-1.5 w-10 group cursor-pointer">
      <div class="w-full bg-gradient-to-t from-secondary to-secondary-container hover:from-secondary-hover hover:to-secondary rounded-t-lg transition-all shadow-sm relative" style="height:${val * 0.7}px" title="${days[i]}: ${val}%">
        <span class="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none transition-opacity">${val}%</span>
      </div>
      <span class="font-label text-xs text-on-surface-variant font-bold">${days[i]}</span>
    </div>
  `
    )
    .join("");

  if ($("#lastUpdate")) {
    $("#lastUpdate").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

// Medication List & Form
function drawMedications() {
  const list = $("#medList");
  if (!list) return;

  if (meds.length === 0) {
    list.innerHTML = `<div class="p-4 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">No medications currently scheduled. Add one above.</div>`;
    return;
  }

  list.innerHTML = meds
    .map(
      (m, i) => `
    <div class="flex items-center justify-between p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[24px]">pill</span>
        <div class="flex flex-col">
          <span class="font-headline text-base font-bold text-on-surface">${esc(m.name)} •${esc(fmtDose(m))}</span>
          <span class="font-body text-xs text-on-surface-variant">${esc(m.time)} · ${esc(m.freq)}</span>
        </div>
      </div>
      <button onclick="removeMedication(${i})" class="p-2 rounded-full hover:bg-surface-container text-error transition-all" title="Remove medication">
        <span class="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  `
    )
    .join("");
}

function removeMedication(idx) {
  meds.splice(idx, 1);
  store.set("memoria_meds", meds);
  drawMedications();
  drawTodaysMeds();
}

$("#medicationForm").onsubmit = (e) => {
  e.preventDefault();
  meds.push({
    name: $("#medName").value.trim(),
    time: $("#medTime").value,
    dose: $("#medDosage").value.trim(),
    freq: $("#medFrequency").value,
  });
  store.set("memoria_meds", meds);
  e.target.reset();
  drawMedications();
  drawTodaysMeds();
};

// Photo Vault List & Form (HTML5 Canvas Compression)
function drawPhotos() {
  const vault = $("#photoVault");
  if (!vault) return;

  if (photos.length === 0) {
    vault.innerHTML = `<div class="col-span-full p-4 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">No photos added yet. Upload one above to anchor memories.</div>`;
    return;
  }

  vault.innerHTML = photos
    .map(
      (p, i) => `
    <div class="relative group rounded-lg overflow-hidden border border-surface-container-high shadow-sm bg-surface-container-low flex flex-col">
      <img src="${p.src}" alt="${esc(p.name)}" class="w-full h-28 object-cover">
      <div class="p-2 flex flex-col">
        <span class="font-headline text-sm font-bold text-on-surface truncate">${esc(p.name)}</span>
        <span class="font-body text-xs text-on-surface-variant truncate">${esc(p.relation)}</span>
      </div>
      <button onclick="removePhoto(${i})" class="absolute top-1 right-1 p-1 rounded-full bg-surface-container-lowest/90 text-error hover:bg-surface-container transition-all" title="Remove photo">
        <span class="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  `
    )
    .join("");
}

function removePhoto(idx) {
  photos.splice(idx, 1);
  store.set("memoria_photos", photos);
  drawPhotos();
  applySettings();
}

$("#photoForm").onsubmit = (e) => {
  e.preventDefault();
  const file = $("#photoFile").files[0];
  if (!file) return;

  const name = $("#photoName").value.trim();
  const relation = $("#photoRelation").value.trim();

  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    const size = 240;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const minDim = Math.min(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      (img.width - minDim) / 2,
      (img.height - minDim) / 2,
      minDim,
      minDim,
      0,
      0,
      size,
      size
    );
    URL.revokeObjectURL(url);

    photos.unshift({
      name,
      relation,
      src: canvas.toDataURL("image/jpeg", 0.8),
    });
    store.set("memoria_photos", photos);
    e.target.reset();
    drawPhotos();
    applySettings();
  };
  img.src = url;
};

// ----------------------------------------------------
// Memory Notes (quick reminders, saved locally, read aloud with speechSynthesis)
// ----------------------------------------------------
let memoryNotes = store.get("memoria_notes", []);
if (!Array.isArray(memoryNotes)) memoryNotes = [];

function drawMemoryNotes() {
  const list = $("#notesList");
  if (!list) return;

  if (memoryNotes.length === 0) {
    list.innerHTML = `<div class="p-4 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface-variant text-base">No notes yet. Write a quick reminder above and tap Save Note.</div>`;
    return;
  }

  list.innerHTML = memoryNotes
    .map(
      (n, i) => `
    <div class="flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low border border-surface-container-high shadow-sm">
      <div class="flex items-center gap-3 min-w-0">
        <span class="material-symbols-outlined text-primary text-[24px] flex-shrink-0">push_pin</span>
        <div class="flex flex-col min-w-0">
          <span class="font-body text-base sm:text-lg text-on-surface break-words">${esc(n.text)}</span>
          <span class="font-label text-xs text-on-surface-variant">${esc(n.when || "")}</span>
        </div>
      </div>
      <button onclick="deleteMemoryNote(${i})" class="note-delete-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-surface-container text-error transition-all flex items-center justify-center flex-shrink-0" title="Delete note" aria-label="Delete note">
        <span class="material-symbols-outlined text-[22px]">delete</span>
      </button>
    </div>
  `
    )
    .join("");
}

function saveMemoryNote() {
  const input = $("#noteInput");
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  const when = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  memoryNotes.unshift({ text, when });
  store.set("memoria_notes", memoryNotes);
  input.value = "";
  drawMemoryNotes();
}

function deleteMemoryNote(idx) {
  memoryNotes.splice(idx, 1);
  store.set("memoria_notes", memoryNotes);
  drawMemoryNotes();
}

function readMemoryNotes() {
  if (!("speechSynthesis" in window)) {
    notify("Reading aloud is not supported in this browser.");
    return;
  }
  // Tapping again while reading stops it
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }
  player.pause();
  const lang = S.lang || "en-US";
  const intro = memoryNotes.length
    ? `${S.patient}, here are your notes.`
    : `${S.patient}, you have no saved notes yet.`;
  const lines = [intro, ...memoryNotes.map((n, i) => `Note ${i + 1}. ${n.text}`)];
  const voice = speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
  lines.forEach((line) => {
    const u = new SpeechSynthesisUtterance(line);
    u.lang = lang;
    u.rate = voiceRate(0.9);
    u.pitch = 1;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  });
}

$("#noteInput").onkeydown = (e) => {
  if (e.key === "Enter") saveMemoryNote();
};


// ----------------------------------------------------
// Caregiver Subscription (mock checkout)
// ----------------------------------------------------
let billing = "monthly";
function setBilling(mode) {
  billing = mode;
  const annual = mode === "annual";
  $("#billMonthly").setAttribute("aria-pressed", String(!annual));
  $("#billAnnual").setAttribute("aria-pressed", String(annual));
  $("#planPrice").textContent = annual ? "$9.99" : "$12.99";
  $("#planBadgeText").textContent = annual ? "Save 25% · Best Value" : "7-Day Free Trial";
  $("#planNote").textContent = annual
    ? "Billed annually at $119.88 (7-day free trial included)."
    : "Then billed monthly after your free trial.";
}
function openCheckout() {
  $("#checkoutSummary").textContent = billing === "annual"
    ? "Memoria Care Plus · Annual · $119.88 / year after trial"
    : "Memoria Care Plus · Monthly · $12.99 / month after trial";
  $("#checkoutForm").classList.remove("hidden");
  $("#checkoutDone").classList.add("hidden");
  $("#checkoutDone").classList.remove("flex");
  $("#checkoutForm").reset();
  $("#checkoutModal").classList.remove("hidden");
  setTimeout(() => $("#cardNumber").focus(), 50);
}
function closeCheckout() {
  $("#checkoutModal").classList.add("hidden");
}
$("#checkoutModal").onclick = (e) => { if (e.target === $("#checkoutModal")) closeCheckout(); };
$("#cardNumber").oninput = (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
};
$("#cardExpiry").oninput = (e) => {
  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
  e.target.value = v;
};
$("#cardCvc").oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); };
$("#checkoutForm").onsubmit = (e) => {
  e.preventDefault();
  const digits = $("#cardNumber").value.replace(/\D/g, "");
  if (digits.length < 13 || !/^\d{2}\/\d{2}$/.test($("#cardExpiry").value) || $("#cardCvc").value.length < 3) {
    notify("Please enter a card number, expiry (MM/YY) and CVC.");
    return;
  }
  const btn = $("#checkoutSubmit");
  btn.disabled = true;
  $("#checkoutSubmitText").textContent = "Processing…";
  setTimeout(() => {
    btn.disabled = false;
    $("#checkoutSubmitText").textContent = "Start Free Trial";
    $("#checkoutForm").classList.add("hidden");
    $("#checkoutDone").classList.remove("hidden");
    $("#checkoutDone").classList.add("flex");
    $("#checkoutDoneMsg").textContent = billing === "annual"
      ? "Welcome to Care Plus Annual. Your 7-day free trial has started."
      : "Welcome to Care Plus. Your 7-day free trial has started.";
    confettiBurst();
  }, 1200);
};

// ----------------------------------------------------
// AI status pill + follow-up suggestions + floating helper
// ----------------------------------------------------
function setAiStatus(state, label) {
  const pill = document.getElementById("aiStatusDot");
  const txt = document.getElementById("aiStatusText");
  if (pill) pill.dataset.state = state || "ready";
  if (txt && label) txt.textContent = label;
}

function renderSuggestions(ans) {
  const box = document.getElementById("aiSuggestions");
  if (!box) return;
  const t = String(ans || "").toLowerCase();
  const mem = store.get("memoria_topic", null);
  let out = [];
  if (/medic|pill|dose|routine|schedule/.test(t)) out = ["Did I take my medicine?", "What is next today?", "Where am I?"];
  else if (/game|faces|story|eyes|play/.test(t)) out = ["Open Faces and Names", "Open my day story", "I feel scared and confused"];
  else if (/scared|afraid|safe|calm|breath|alone|sad/.test(t)) out = [`Who is ${S.caregiver}?`, "Sing me a song", "Tell me a story"];
  else if (/love|family|daughter|son|caregiver/.test(t)) out = ["Tell me a happy memory", "Where am I?", "What day is it today?"];
  else if (/story|garden|house|flowers|morning/.test(t)) out = ["Tell me more", "Tell me a story", "Let's play a game"];
  else if (/medicine today/.test(t)) out = ["Did I take my medicine?", "What is next today?"];
  else if (mem && mem.topic === "meds") out = ["Did I take my medicine?", "What is next today?"];
  else if (mem && mem.topic === "family") out = ["Tell me more", "Where am I?"];
  else out = ["What day is it today?", "Tell me a joke", "Let's play a game"];
  box.innerHTML = "";
  out.slice(0, 3).forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.onclick = () => ask(q);
    box.appendChild(b);
  });
}

let _helperOpen = false;
function toggleAiHelper(open) {
  _helperOpen = open === undefined ? !_helperOpen : !!open;
  const p = document.getElementById("aiHelperPanel");
  if (p) p.classList.toggle("hidden", !_helperOpen);
  if (_helperOpen) {
    const badge = document.getElementById("aiFabBadge");
    if (badge) badge.classList.add("hidden");
    setTimeout(() => { const i = document.getElementById("aiHelperInput"); if (i) i.focus(); }, 60);
  }
}

function _helperPush(text, who) {
  const log = document.getElementById("aiHelperLog");
  if (!log) return;
  const d = document.createElement("div");
  d.className = "hmsg " + (who === "user" ? "user" : "ai");
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

async function aiHelperAction(kind) {
  toggleAiHelper(true);
  const done = $$("#routineList input").filter((c) => c.checked).length;
  const total = $$("#routineList input").length;
  if (kind === "summarize") {
    _helperPush("Here is your day so far:", "ai");
    _helperPush(`${done} of ${total} routine steps done. ${meds.length} medication${meds.length === 1 ? "" : "s"} scheduled. Next dose: ${(document.getElementById("nextDoseText") || {}).textContent || "—"}.`, "ai");
    speak(`${S.patient}, you have finished ${done} of ${total} routine steps today.`);
    return;
  }
  if (kind === "meds") {
    const line = meds.length ? meds.map((m) => `${m.name}${fmtDose(m)} at ${m.time}`).join("; ") : "No medications scheduled.";
    _helperPush(line, "ai");
    speak(line);
    return;
  }
  if (kind === "calm") {
    const line = `Take a slow, deep breath, ${S.patient}. You are safe at home in ${S.location}. ${S.caregiver} loves you very much.`;
    _helperPush(line, "ai");
    speak(line);
    return;
  }
  if (kind === "game") {
    _helperPush("Opening Brain Gym — a gentle game is ready for you.", "ai");
    switchMainTab("brain-gym");
    return;
  }
  _helperPush("Ask me about your day, meds, or games.", "ai");
}

function wireAiHelper() {
  const comfort = [
    ["textSizeNormal", () => setTextSize("normal")],
    ["textSizeLarge", () => setTextSize("large")],
    ["textSizeXL", () => setTextSize("xl")],
    ["voiceSlow", () => setVoiceSpeed("slow")],
    ["voiceNormal", () => setVoiceSpeed("normal")],
    ["voiceFast", () => setVoiceSpeed("fast")],
  ];
  comfort.forEach(([id, fn]) => {
    const b = document.getElementById(id);
    if (b && !b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", fn); }
  });
  const fab = document.getElementById("aiHelperFab");
  if (fab && !fab.dataset.wired) {
    fab.dataset.wired = "1";
    fab.addEventListener("click", () => toggleAiHelper());
    fab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAiHelper(); } });
  }
  const form = document.getElementById("aiHelperForm");
  if (form && !form.dataset.wired) {
    form.dataset.wired = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = document.getElementById("aiHelperInput");
      const v = inp ? inp.value.trim() : "";
      if (!v) return;
      inp.value = "";
      _helperPush(v, "user");
      detectMood(v);
      // repeat detection: same question twice -> warmer first-time tone
      const nq = normQ(v);
      _lastCount = nq === _lastQ ? _lastCount + 1 : 1;
      _lastQ = nq;
      aiReply(v).then((res) => {
        const ans = String((res && res.text) || "").replace(/\[\[.*?\]\]/g, "").trim() || offlineAssistant(v);
        _helperPush(ans, "ai");
        speak(ans);
      }).catch(() => _helperPush(offlineAssistant(v), "ai"));
    });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && _helperOpen) toggleAiHelper(false); });
  if (!document.getElementById("aiHelperLog").children.length) {
    _helperPush(`Hello ${S.patient}. I can summarize your day, check meds, or open a game.`, "ai");
  }
  renderSuggestions(`Hello ${S.patient}! I'm Memoria, your gentle companion.`);
}

// ----------------------------------------------------
// App Initialization (runs once, whether or not the DOM is already ready)
// ----------------------------------------------------
function initApp() {
  tickClock();
  applyComfort();
  newSudokuPuzzle();
  loadWordPuzzle(0);
  resetMemoryMatchGame();
  renderCaregiverChart();
  drawMedications();
  drawPhotos();
  drawMemoryNotes();
  applySettings();
  wireAiHelper();
  resetFacesGame();
  resetEyesGame();
  resetStoryGame();
  paintGymProgress();
  eyesBest = store.get("memoria_eyes_best", null);
  paintEyesBest();
}

initApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", memoriaMain);
} else {
  memoriaMain();
}