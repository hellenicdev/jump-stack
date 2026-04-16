      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-7ZW11J5QKQ');
      gtag('config', 'G-9K0TYZFZS2');
	  
	  
	  
/* ════════════════════════════════════════════════════════
   ANALYTICS — Lightweight GA4 wrapper (gtag.js)
   ════════════════════════════════════════════════════════ */
var analyticsEnabled = true;

function safeTrack(eventName, params) {
    try {
        if (!analyticsEnabled || typeof gtag !== 'function') return;
        var clean = {};
        for (var k in params) {
            if (params[k] !== undefined && params[k] !== null) clean[k] = params[k];
        }
        gtag('event', eventName, clean);
    } catch (_) {}
}

function getRetention() {
    var key = '100j_first_play';
    var today = new Date().toISOString().slice(0, 10);
    var first = localStorage.getItem(key);
    if (!first) { first = today; try { localStorage.setItem(key, today); } catch (_) {} }
    var ms = new Date(today) - new Date(first);
    return { first_play_date: first, days_since_first_play: Math.round(ms / 86400000) };
}

function trackGameStart(seed, attemptNumber, startingLives) {
    var r = getRetention();
    safeTrack('game_start', { run_seed: seed, attempt_number: attemptNumber, starting_lives: startingLives, first_play_date: r.first_play_date, days_since_first_play: r.days_since_first_play });
}

function trackJumpFail(jumpNumber, remainingJumps, hadLifeAvailable, livesLeft, runTimeSec, attemptNumber) {
    safeTrack('jump_fail', { jump_number: jumpNumber, remaining_jumps: remainingJumps, had_life_available: hadLifeAvailable, lives_left: livesLeft, run_time_sec: runTimeSec, attempt_number: attemptNumber });
}

function trackGameEnd(score, outcome, attemptNumber, runTimeSec, livesLeft, maxPerfectStreak, totalPerfects, totalLivesGained) {
    safeTrack('game_end', { score: score, outcome: outcome, attempt_number: attemptNumber, run_time_sec: runTimeSec, lives_left: livesLeft, max_perfect_streak: maxPerfectStreak, total_perfects: totalPerfects, total_lives_gained: totalLivesGained });
}

function trackAchievementUnlock(achievementId) {
    safeTrack('achievement_unlock', { achievement_id: achievementId });
}

/*
 * ════════════════════════════════════════════════════════════════
 *  Jump Stack — A single-file mobile platformer game
 * ════════════════════════════════════════════════════════════════
 *
 *  HOW THE GAME WORKS:
 *  - The player stands on a platform and must jump to the next one.
 *  - Hold the screen to charge jump power, release to jump.
 *  - Longer hold = further/higher jump. It's all about timing.
 *  - Score counts down from 100. Reaching 0 = you win!
 *  - Landing in the center of a platform = "PERFECT".
 *  - 3 perfects in a row = earn 1 extra life.
 *  - Lives save you from a missed jump (respawn on previous platform).
 *
 *  HOW THE CODE IS STRUCTURED:
 *  1. THEME / PHYSICS / GENERATION / GAMEPLAY — All tunable constants
 *  2. State variables — Everything that changes at runtime
 *  3. Setup — init(), resize(), platform generation
 *  4. Update — Physics, collision detection, camera movement
 *  5. Render — Drawing background, platforms, character, UI
 *  6. Overlays — Game over and win popups (HTML/CSS modal)
 *  7. Effects — Floating text messages and ring pulse
 *  8. Input — Touch and mouse handlers
 *  9. Utilities — Math helpers and rounded-rect drawing
 *  10. Game loop — requestAnimationFrame loop
 *
 *  COORDINATE SYSTEM:
 *  - All positions are in screen pixels, scaled by S (= screenWidth / 400).
 *  - S is the universal scale factor. A value of "50" in config means
 *    50 "design units" which get multiplied by S for actual pixels.
 *  - The world scrolls horizontally. cam.x is the left edge of the
 *    visible area in world coordinates. To draw something at world
 *    position wx, draw it at (wx - cam.x) on screen.
 *  - Y-axis points DOWN (standard canvas). Higher y = lower on screen.
 *
 *  GAME STATES:
 *  'idle'     — Standing on a platform, waiting for input
 *  'charging' — Holding down, power bar filling up
 *  'jumping'  — In the air after releasing, physics active
 *  'falling'  — Overshot the next platform, falling to death
 *  'landed'   — Brief pause after landing before camera moves (GAMEPLAY.landPause)
 *  'panning'  — Camera sliding to frame the next platform after landing
 *  'gameover' — Dead, showing game over overlay
 */

/* ════════════════════════════════════════════════════════
   CONFIGURATION — Edit these to customise look and feel
   ════════════════════════════════════════════════════════ */
const THEME = {
    background: '#EDF2F8',

    /*
     * CHARACTER — The player square with eyes.
     * To swap for a sprite: change drawCharacter() to use ctx.drawImage()
     * and load your sprite sheet. The width/height here control the
     * collision box size regardless of how you draw it.
     */
    character: {
        width: 27, height: 27,   // Collision box in design units
        color: '#6366f1',        // Body fill (indigo)
        eyeWhite: '#ffffff',
        pupil: '#312e81',
    },

    /*
     * PLATFORM — Flat ledge style.
     * To swap art: change drawPlatform(). Each platform object has
     * { x, y, w } in world-pixel coords. y is the TOP surface.
     */
    platform: {
        height: 8,                        // Thickness in design units
        color: '#7C8AA5',                 // Slab fill color (muted slate blue-gray)
        startWidth: 110,                  // First platform is wider for safety
    },

    /*
     * UI COLORS — Used for score text, floating messages, etc.
     */
    ui: {
        scoreColor: '#23304D',                    // Main score number
        dimColor: '#7C8AA5',                      // Subtitle/secondary text
        perfectColor: '#24C78B',                  // "PERFECT!" text and streak dots
        lifeColor: '#FF5B78',                     // Hearts and "+1 LIFE" text
        streakInactive: '#B7DEC9',                // Inactive streak ring dots
        hintColor: 'rgba(100,116,139,0.55)',      // First-time hint text
    },
};

const THEME_LIGHT = {
    background: '#EDF2F8',
    platform: { color: '#7C8AA5' },
    ui: {
        scoreColor: '#23304D',
        dimColor: '#7C8AA5',
        perfectColor: '#24C78B',
        lifeColor: '#FF5B78',
        streakInactive: '#B7DEC9',
        hintColor: 'rgba(100,116,139,0.55)',
    },
};

const THEME_DARK = {
    background: '#111827',
    platform: { color: '#4b5563' },
    ui: {
        scoreColor: '#e2e8f0',
        dimColor: '#64748b',
        perfectColor: '#34d399',
        lifeColor: '#fb7185',
        streakInactive: '#2d4a3e',
        hintColor: 'rgba(148,163,184,0.5)',
    },
};

function applyTheme(dark) {
    var src = dark ? THEME_DARK : THEME_LIGHT;
    THEME.background = src.background;
    THEME.platform.color = src.platform.color;
    for (var k in src.ui) THEME.ui[k] = src.ui[k];
    document.body.classList.toggle('dark', dark);
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', dark ? '#111827' : '#EDF2F8');
}

/*
 * PHYSICS — Controls how the jump feels.
 *
 * Jump velocity is calculated as:
 *   vx = power * maxVX * S        (horizontal speed)
 *   vy = -(minVY + power * (maxVY - minVY)) * S  (upward speed, negative = up)
 *
 * Where power is 0→1 based on how long you hold.
 * Gravity pulls the character down each frame: vy += gravity * S * dt
 *
 * Higher gravity = snappier/faster arcs.
 * Higher maxVY = taller arcs. Higher maxVX = longer jumps.
 */
const PHYSICS = {
    gravity: 2256,       // Downward acceleration (design units/s²)
    maxVX: 594,          // Max horizontal velocity at full power
    maxVY: 1069,         // Maximum upward velocity (full charge)
    minVY: 250,          // Minimum upward velocity (tiny tap)
    chargeTime: 1.1,     // Seconds to reach full power
    minPower: 0.07,      // Floor value so even a tap gives a small jump
};

/*
 * GENERATION — Difficulty curve for platform placement.
 *
 * Instead of flat random ranges, getDifficulty(jumpN) returns generation
 * parameters that scale with jump number. Six tiers blend smoothly:
 *   1–10  very easy   |  11–25 easy   |  26–45 medium
 *   46–70 hard        |  71–90 very hard  |  91–101 peak
 *
 * "Confidence traps" occasionally appear: 2–3 easy jumps then one hard one.
 */
const GENERATION = {
    minY: 0.38,
    maxY: 0.72,
};

const DIFFICULTY_TIERS = [
    //  upTo  minGap maxGap  minDY maxDY  platMin platMax
    {   n: 5,   minGap: 20, maxGap:  40, minDY:  -5, maxDY:  8, platMin: 100, platMax: 120 },
    {   n: 10,  minGap: 35, maxGap:  70, minDY: -15, maxDY: 20, platMin: 85, platMax: 110 },
    {   n: 25,  minGap: 40, maxGap:  95, minDY: -25, maxDY: 30, platMin: 72, platMax: 105 },
    {   n: 45,  minGap: 42, maxGap: 120, minDY: -40, maxDY: 40, platMin: 58, platMax:  95 },
    {   n: 70,  minGap: 48, maxGap: 152, minDY: -52, maxDY: 46, platMin: 46, platMax:  80 },
    {   n: 90,  minGap: 52, maxGap: 170, minDY: -58, maxDY: 50, platMin: 40, platMax:  70 },
    // ── Epic finale ──
    {   n: 95,  minGap: 58, maxGap: 182, minDY: -62, maxDY: 54, platMin: 36, platMax:  58 },
    {   n: 98,  minGap: 62, maxGap: 196, minDY: -66, maxDY: 58, platMin: 30, platMax:  48 },
    // ── Final jump: tiny-to-tiny at near-max distance ──
    {   n: 100, minGap: 185, maxGap: 205, minDY: -10, maxDY: 20, platMin: 26, platMax: 32 },
    {   n: 101, minGap: 185, maxGap: 205, minDY: -10, maxDY: 20, platMin: 26, platMax: 32 },
];

function lerpVal(a, b, t) { return a + (b - a) * t; }

function getDifficulty(jumpN) {
    var tiers = LEVELS[activeLevel].tiers;
    let prev = tiers[0];
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (jumpN <= tier.n) {
            const prevN = i === 0 ? 0 : tiers[i - 1].n;
            const t = (jumpN - prevN) / (tier.n - prevN);
            prev = i === 0 ? tier : tiers[i - 1];
            return {
                minGap:  lerpVal(prev.minGap,  tier.minGap,  t),
                maxGap:  lerpVal(prev.maxGap,  tier.maxGap,  t),
                minDY:   lerpVal(prev.minDY,   tier.minDY,   t),
                maxDY:   lerpVal(prev.maxDY,   tier.maxDY,   t),
                platMin: lerpVal(prev.platMin, tier.platMin, t),
                platMax: lerpVal(prev.platMax, tier.platMax, t),
            };
        }
    }
    const last = tiers[tiers.length - 1];
    return { minGap: last.minGap, maxGap: last.maxGap, minDY: last.minDY,
             maxDY: last.maxDY, platMin: last.platMin, platMax: last.platMax };
}

/**
 * Confidence trap: every so often, after a few easy jumps, insert one
 * notably harder jump. Returns true if jumpN should be a trap.
 */
function isConfidenceTrap(jumpN) {
    if (LEVELS[activeLevel].id !== 'classic') return false;
    if (jumpN < 20) return false;
    if (jumpN > 90) return false;
    const cycle = ((jumpN - 20) % 11);
    return cycle === 7;
}

/*
 * GAMEPLAY — Core game rules.
 */
const GAMEPLAY = {
    totalJumps: 100,    // Jumps needed to "complete" the game
    perfectZone: 0.2,  // Center 20% of platform width counts as perfect landing
    perfectsForLife: 3, // Consecutive perfects needed to earn an extra life
    cameraPanMin: 0.75,  // Fastest camera pan (short hops)
    cameraPanMax: 0.95,  // Slowest camera pan (long leaps)
    landPause: 0,   // Seconds to pause on landing before camera starts panning
};

/* ════════════════════════════════════════════════════════
   LEVELS — Selectable difficulty modes
   ════════════════════════════════════════════════════════ */
const EXTREME_TIERS = [
    {   n: 5,   minGap: 50, maxGap: 160, minDY: -55, maxDY: 48, platMin: 38, platMax: 65 },
    {   n: 25,  minGap: 52, maxGap: 170, minDY: -58, maxDY: 50, platMin: 36, platMax: 60 },
    {   n: 50,  minGap: 55, maxGap: 178, minDY: -60, maxDY: 52, platMin: 34, platMax: 55 },
    {   n: 75,  minGap: 58, maxGap: 185, minDY: -62, maxDY: 54, platMin: 32, platMax: 50 },
    {   n: 90,  minGap: 60, maxGap: 192, minDY: -64, maxDY: 56, platMin: 30, platMax: 46 },
    {   n: 95,  minGap: 62, maxGap: 196, minDY: -66, maxDY: 58, platMin: 28, platMax: 42 },
    {   n: 98,  minGap: 65, maxGap: 200, minDY: -68, maxDY: 60, platMin: 26, platMax: 38 },
    {   n: 100, minGap: 190, maxGap: 210, minDY: -10, maxDY: 20, platMin: 24, platMax: 30 },
    {   n: 101, minGap: 190, maxGap: 210, minDY: -10, maxDY: 20, platMin: 24, platMax: 30 },
];

var LEVELS = [
    {
        id: 'classic',
        name: 'Jump Stack',
        desc: 'The original. Platforms get smaller and further apart.',
        color: '#6366f1',
        tiers: DIFFICULTY_TIERS,
        statsKey: '100j_stats',
        attemptsKey: '100j_attempts',
    },
    {
        id: 'extreme',
        name: 'Extreme',
        desc: 'Max difficulty from the very first jump.',
        color: '#ef4444',
        tiers: EXTREME_TIERS,
        statsKey: '100j_stats_extreme',
        attemptsKey: '100j_attempts_extreme',
        requiresTrophy: 'beatGame',
    },
];
var activeLevel = 0;
try {
    var _al = parseInt(localStorage.getItem('100j_last_level'), 10);
    if (_al >= 0 && _al < LEVELS.length) activeLevel = _al;
} catch (_) {}

/* ════════════════════════════════════════════════════════
   SETTINGS — Persisted user preferences
   ════════════════════════════════════════════════════════ */
var _darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
var settings = { sound: true, vibration: true, volume: 0.8, darkMode: _darkMQ.matches };
try {
    var _s = JSON.parse(localStorage.getItem('100j_settings'));
    if (_s) {
        settings.sound = _s.sound !== false;
        settings.vibration = _s.vibration !== false;
        if (typeof _s.volume === 'number') settings.volume = _s.volume;
        if (typeof _s.darkMode === 'boolean') settings.darkMode = _s.darkMode;
    }
} catch (_) {}
applyTheme(settings.darkMode);
_darkMQ.addEventListener('change', function (e) {
    settings.darkMode = e.matches;
    applyTheme(settings.darkMode);
    saveSettings();
    if (typeof syncToggles === 'function') syncToggles();
});
function saveSettings() {
    try { localStorage.setItem('100j_settings', JSON.stringify(settings)); } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   ATTEMPTS — Persisted attempt counters
   ════════════════════════════════════════════════════════ */
var attempts = { active: 0, total: 0 };
function loadAttempts(key) {
    attempts = { active: 0, total: 0 };
    try {
        var _a = JSON.parse(localStorage.getItem(key));
        if (_a) { attempts.active = _a.active || 0; attempts.total = _a.total || 0; }
    } catch (_) {}
}
loadAttempts('100j_attempts');
function saveAttempts() {
    try { localStorage.setItem(LEVELS[activeLevel].attemptsKey, JSON.stringify(attempts)); } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   STATS & ACHIEVEMENTS — Persisted tracking
   ════════════════════════════════════════════════════════ */
var TROPHIES = [
    { id: 'firstSteps', name: 'First Steps', desc: 'Land your first jump', icon: '👟' },
    { id: 'bullseye', name: 'Bullseye', desc: 'Land your first PERFECT', icon: '🎯' },
    { id: 'onARoll', name: 'On a Roll', desc: 'Reach 50 remaining', icon: '🔥' },
    { id: 'triplePerfect', name: 'Triple Perfect', desc: 'Land 3 PERFECTs in a row', icon: '✨' },
    { id: 'tenPerfects', name: 'Locked In', desc: 'Land 10 PERFECTs in a row', icon: '🌟' },
    { id: 'beatGame', name: 'Champion', desc: 'Beat 100 JUMPS', icon: '🏆' },
    { id: 'cleanFinish', name: 'Clean Finish', desc: 'PERFECT the final jump to 0', icon: '💎' },
    { id: 'perfectFinish', name: 'Perfect Finish', desc: 'PERFECT the last 5 jumps', icon: '👑' },
    { id: 'steadyHands', name: 'Steady Hands', desc: 'Beat in ≤100 attempts', icon: '🧘' },
    { id: 'underPressure', name: 'Under Pressure', desc: 'Beat in ≤20 attempts', icon: '⚡' },
    { id: 'fullSend', name: 'Full Send', desc: 'Launch at maximum power', icon: '💨' },
    { id: 'untouchable', name: 'Untouchable', desc: 'Beat without a single miss', icon: '🛡️' },
];

var gameStats = {
    allTime: { bestScore: 0, bestAttempts: 0, jumpsAttempted: 0, successfulLands: 0 },
    currentRun: { bestScore: 0, jumpsAttempted: 0, successfulLands: 0 },
    achievements: {},
};
function loadGameStats(key) {
    gameStats = {
        allTime: { bestScore: 0, bestAttempts: 0, jumpsAttempted: 0, successfulLands: 0 },
        currentRun: { bestScore: 0, jumpsAttempted: 0, successfulLands: 0 },
        achievements: {},
    };
    try {
        var _gs = JSON.parse(localStorage.getItem(key));
        if (_gs) {
            if (_gs.allTime) {
                gameStats.allTime.bestScore = _gs.allTime.bestScore || 0;
                gameStats.allTime.bestAttempts = _gs.allTime.bestAttempts || 0;
                gameStats.allTime.jumpsAttempted = _gs.allTime.jumpsAttempted || 0;
                gameStats.allTime.successfulLands = _gs.allTime.successfulLands || 0;
            }
            if (_gs.currentRun) {
                gameStats.currentRun.bestScore = _gs.currentRun.bestScore || 0;
                gameStats.currentRun.jumpsAttempted = _gs.currentRun.jumpsAttempted || 0;
                gameStats.currentRun.successfulLands = _gs.currentRun.successfulLands || 0;
            }
            if (_gs.achievements) gameStats.achievements = _gs.achievements;
        }
    } catch (_) {}
}
loadGameStats('100j_stats');
function saveGameStats() {
    try { localStorage.setItem(LEVELS[activeLevel].statsKey, JSON.stringify(gameStats)); } catch (_) {}
}

function isLevelUnlocked(lvl) {
    if (!lvl.requiresTrophy) return true;
    try {
        var cs = JSON.parse(localStorage.getItem('100j_stats'));
        return cs && cs.achievements && !!cs.achievements[lvl.requiresTrophy];
    } catch (_) { return false; }
}

function loadLevelStats(levelIdx) {
    activeLevel = levelIdx;
    try { localStorage.setItem('100j_last_level', String(levelIdx)); } catch (_) {}
    loadGameStats(LEVELS[levelIdx].statsKey);
    loadAttempts(LEVELS[levelIdx].attemptsKey);
}

function unlockAchievement(id) {
    if (gameStats.achievements[id]) return;
    gameStats.achievements[id] = true;
    saveGameStats();
    trackAchievementUnlock(id);
}

/* ════════════════════════════════════════════════════════
   INTERNAL STATE — Runtime variables (reset by init())
   ════════════════════════════════════════════════════════ */
const cv = document.getElementById('gc');   // Canvas element
const ctx = cv.getContext('2d');             // 2D drawing context
const modal = document.getElementById('modal');
const mTitle = document.getElementById('mt');
const mSub = document.getElementById('ms');
const mBtn = document.getElementById('mb');
const mBrand = document.getElementById('mbrand');
const mDetail = document.getElementById('mdetail');
const mAvatar = document.getElementById('modal-avatar');
const mAvatarMouth = document.getElementById('av-mouth');
const mAvatarPupilL = document.getElementById('av-pupil-l');
const mAvatarPupilR = document.getElementById('av-pupil-r');

function setAvatarFace(mood) {
    if (mood === 'happy') {
        mAvatarPupilL.setAttribute('cx', '19.5'); mAvatarPupilL.setAttribute('cy', '24');
        mAvatarPupilR.setAttribute('cx', '43.5'); mAvatarPupilR.setAttribute('cy', '24');
        mAvatarMouth.setAttribute('d', 'M17 39 Q30 52 43 39');
    } else {
        mAvatarPupilL.setAttribute('cx', '17'); mAvatarPupilL.setAttribute('cy', '27');
        mAvatarPupilR.setAttribute('cx', '41'); mAvatarPupilR.setAttribute('cy', '27');
        mAvatarMouth.setAttribute('d', 'M22 44 Q30 39 38 44');
    }
}

let W, H, S;        // W = canvas width (px), H = canvas height (px), S = scale factor (W/400)
let safeTop = 0;     // Safe area inset top (px) — accounts for iPhone notch in PWA mode
let fonts = {};      // Cached font strings, rebuilt on resize

let state;           // Current game state string: 'idle', 'charging', 'jumping', 'falling', 'panning', 'gameover'
let player;          // { x, y, vx, vy, platIdx } — position/velocity in world pixels, platIdx = current platform index
let platforms;       // Array of { x, y, w } — all generated platforms in world coordinates
let cam;             // { x, target, start, progress } — camera horizontal offset and pan animation state
let power;           // 0→1 charge level while holding
let streak;          // Current consecutive perfect landing count (resets on life gain for HUD dots)
let achieveStreak;   // Unbroken consecutive perfects (never resets on life gain, used for achievements)
let lives;           // Extra lives earned from perfects (each saves you from one fall)
let completed;       // true once the player reaches 0 jumps remaining
let firstJump;       // true until the player completes their first jump (used to show hint text)
let score;           // { remaining: N } — countdown from 100 to 0
let floats;          // Array of floating text messages ("PERFECT!", "+1 LIFE", etc.)
let ringPulse;       // Active ring pulse effect { x, y, color, age, dur, maxR }
let landTimer;       // Countdown timer for the brief pause after landing before camera pans
let fadeOutIdx;      // Index of the platform animating out after landing (-1 = none)
const hasKeyboard = window.matchMedia('(hover: hover) and (pointer: fine)').matches; // Desktop with keyboard
let lastTS;          // Timestamp of the previous animation frame (for calculating delta time)
let missedJump;      // true if player fell off screen this game (for Untouchable)
let allPerfect;      // Running count of consecutive perfect forward landings (for Perfect Finish)
let newHighScore;    // true if this run set a new all-time best score
let runSeed;         // Random identifier for this run (analytics)
let runStartTime;    // Timestamp when this run began (analytics)
let maxStreak;       // Highest consecutive-perfect streak this run (analytics)
let totalPerfects;   // Total perfect landings this run (analytics)
let totalLivesGained; // Total extra lives earned this run (analytics)
let hudFadeAlpha;    // 1→0 fade for HUD on game over
let winHudMode;      // true while congratulations modal is open (hides score, keeps hearts/streak)
let smileTimer;      // >0 when character should show a smile (after perfect landing)
let wowTimer;        // >0 when character should show an 😮 face (close-edge landing)
let wowEdgeDir;      // -1 = near left edge, +1 = near right edge
let nearMissShake;   // >0 triggers a damped wobble on close-edge landings
let inputBuffer;     // true while a press is buffered during a jump, waiting for landing

/** getY(p) — Returns the Y position of a platform. */
function getY(p) {
    return p.y;
}

/* ════════════════════════════════════════════════════════
   SOUND — Web Audio API synthesized effects
   ════════════════════════════════════════════════════════
   Uses the 'ambient' audio session category so sounds layer
   on top of podcasts / background music on mobile instead
   of interrupting them (same approach as most casual games).
   All sounds are generated with oscillators — no audio files.
*/
let audioCtx = null;

function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // 'ambient' mixes with other apps and respects the mute switch
        if (navigator.audioSession) {
            navigator.audioSession.type = 'ambient';
        }
    } catch (_) {}
}

function playTone(freq, type, duration, vol, delay) {
    if (!settings.sound || !audioCtx) return;
    const t = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol * settings.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function vib(pattern) { if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern); }

function sfxJump() {
    vib(10);
    if (!settings.sound || !audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.07);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    g.gain.setValueAtTime(0.28 * settings.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
}

function sfxLand() {
    vib(12);
    if (!settings.sound || !audioCtx) return;
    var t = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    g.gain.setValueAtTime(0.18 * settings.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.065);
}

function sfxLoseLife() {
    vib(60);
    if (!settings.sound || !audioCtx) return;
    playTone(520, 'sine', 0.15, 0.28);
    playTone(390, 'triangle', 0.2, 0.26, 0.12);
}

function sfxPerfect(currentStreak) {
    vib([12, 30, 12]);
    if (!settings.sound || !audioCtx) return;
    var t = audioCtx.currentTime;
    var bases = [523, 587];
    var base = bases[currentStreak - 1] || bases[bases.length - 1];
    var vol = 0.24 + currentStreak * 0.04;
    var dur = 0.3 + currentStreak * 0.06;
    var ratios = [1, 1.25, 1.5];
    if (currentStreak >= 2) ratios.push(2);
    ratios.forEach(function (ratio, i) {
        var delay = i * 0.045;
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(base * ratio, t + delay);
        g.gain.setValueAtTime(vol * (1 - i * 0.12) * settings.volume, t + delay);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(t + delay); osc.stop(t + delay + dur + 0.01);
    });
}

function sfxLife() {
    vib([15, 30, 15, 30, 25]);
    if (!settings.sound || !audioCtx) return;
    var t = audioCtx.currentTime;
    // E5 (Mi) completing Do-Re-Mi — same chord style as perfects but richer and longer
    var base = 659;
    var vol = 0.32;
    [1, 1.25, 1.5, 2].forEach(function (ratio, i) {
        var delay = i * 0.04;
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(base * ratio, t + delay);
        g.gain.setValueAtTime(vol * (1 - i * 0.08) * settings.volume, t + delay);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.65);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(t + delay); osc.stop(t + delay + 0.66);
    });
}

function sfxWin() {
    vib([15, 40, 15, 40, 15, 40, 25]);
    if (!settings.sound || !audioCtx) return;
    var t = audioCtx.currentTime;
    var notes = [523, 659, 784, 1047];
    notes.forEach(function (freq, i) {
        var delay = i * 0.12;
        [1, 1.5, 2].forEach(function (ratio, j) {
            var osc = audioCtx.createOscillator();
            var g = audioCtx.createGain();
            osc.type = j === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq * (j === 2 ? 1 : ratio), t + delay);
            if (j === 0) osc.frequency.exponentialRampToValueAtTime(freq * ratio * 1.02, t + delay + 0.6);
            var vol = (0.28 - j * 0.06) * settings.volume;
            g.gain.setValueAtTime(vol, t + delay);
            g.gain.setValueAtTime(vol, t + delay + 0.35);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.9);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(t + delay); osc.stop(t + delay + 0.91);
        });
    });
    // Shimmering high tail
    var shimmer = audioCtx.createOscillator();
    var sg = audioCtx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2093, t + 0.48);
    sg.gain.setValueAtTime(0.15 * settings.volume, t + 0.48);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    shimmer.connect(sg); sg.connect(audioCtx.destination);
    shimmer.start(t + 0.48); shimmer.stop(t + 1.81);
}

function sfxGameOver() {
    vib(120);
    playTone(392, 'sine', 0.22, 0.30);
    playTone(330, 'triangle', 0.22, 0.28, 0.18);
    playTone(277, 'sine', 0.22, 0.28, 0.36);
    playTone(220, 'triangle', 0.45, 0.34, 0.54);
}

/* ════════════════════════════════════════════════════════
   SETUP — Initialisation and platform generation
   ════════════════════════════════════════════════════════ */

/**
 * resize() — Called on load, window resize, and orientation change.
 * Sets the canvas resolution to match the display size × devicePixelRatio
 * for crisp rendering. Calculates S (scale factor) based on the smaller
 * screen dimension so elements stay a consistent size in any orientation.
 * Wider/taller screens simply show more of the world.
 *
 * When called mid-game (e.g. orientation switch), rescales all world
 * positions so the game continues seamlessly without losing progress.
 */
function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prevW = W, prevH = H, prevS = S;
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // S is based on the smaller dimension so portrait and landscape give
    // the same element sizes. Capped at 1.6 so desktop doesn't over-scale.
    // Phone portrait (375×667): S=0.94. Phone landscape (667×375): S=0.94.
    // Desktop (1920×1080): S=1.6.
    S = Math.min(Math.min(W, H) / 295, 1.7);

    safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10);

    const ff = '-apple-system, system-ui, sans-serif';
    fonts = {
        score:    '800 ' + (38 * S) + 'px ' + ff,
        subtitle: '600 ' + (11 * S) + 'px ' + ff,
        lives:    (16 * S) + 'px ' + ff,
        streak:   '700 ' + (10 * S) + 'px ' + ff,
        hint:     '500 ' + (11 * S) + 'px ' + ff,
        floatPx:  S,
    };

    // Rescale all world positions when dimensions change mid-game
    if (prevS && prevS > 0 && platforms && platforms.length > 0) {
        const sr = S / prevS;           // Ratio for S-dependent values (x, widths, velocities)
        const hr = prevH > 0 ? H / prevH : 1; // Ratio for Y positions (screen height changed)

        if (sr !== 1 || hr !== 1) {
            // Rescale platform positions and sizes
            for (const p of platforms) {
                p.x *= sr;
                p.w *= sr;
                p.y *= hr;
            }

            // Rescale player position
            player.x *= sr;
            if (state === 'jumping' || state === 'falling') {
                player.y *= hr;
                player.vx *= sr;
                player.vy *= hr;
            } else {
                player.y = getY(platforms[player.platIdx]) - THEME.character.height * S;
            }

            // Rescale camera
            cam.x *= sr;
            cam.start *= sr;
            setCamTarget();
            if (state !== 'panning') cam.x = cam.target;

            // Rescale active effects
            for (const f of floats) { f.x *= sr; f.y *= hr; }
            // Generate platforms to fill any newly visible area
            ensurePlatforms(cam.x);
        }
    }
}

/**
 * init() — Resets all game state and creates the initial platforms.
 * Called once on page load and again each time the player restarts.
 */
function init() {
    resize();
    THEME.character.color = LEVELS[activeLevel].color;
    state = 'idle';
    power = 0; streak = 0; achieveStreak = 0; lives = 0;
    completed = false;
    attempts.active++;
    attempts.total++;
    saveAttempts();
    try { firstJump = !localStorage.getItem('100j_played'); } catch (_) { firstJump = false; }
    landTimer = 0; lastTS = 0; fadeOutIdx = -1;
    missedJump = false; allPerfect = 0; newHighScore = false;
    hudFadeAlpha = 1; winHudMode = false; smileTimer = 0; wowTimer = 0; wowEdgeDir = 1; nearMissShake = 0; inputBuffer = false;
    runSeed = Math.random().toString(36).substr(2, 8);
    runStartTime = Date.now();
    maxStreak = 0; totalPerfects = 0; totalLivesGained = 0;
    score = { remaining: GAMEPLAY.totalJumps };
    floats = []; ringPulse = null;

    // Create the first platform at 60% of screen height (comfortably in lower half)
    const y0 = H * 0.6;
    platforms = [{ x: 25 * S, y: y0, w: THEME.platform.startWidth * S }];
    // Generate enough platforms to fill the visible screen plus a buffer
    ensurePlatforms(25 * S);

    // Place the player on the first platform, slightly left of center
    const p0 = platforms[0];
    player = {
        x: p0.x + p0.w * 0.4 - THEME.character.width * S / 2,
        y: p0.y - THEME.character.height * S, // Sitting on top of platform
        vx: 0, vy: 0, platIdx: 0,
    };

    // Initialise camera and snap to starting position (no animation)
    cam = { x: 0, target: 0, start: 0, progress: 1, dur: 0.45 };
    setCamTarget();
    cam.x = cam.target;

    modal.classList.remove('show');
    trackGameStart(runSeed, attempts.active, lives);

    // Warm up fonts — rasterise every weight/size/glyph combo used in-game
    // so the first PERFECT landing doesn't trigger a synchronous font resolve.
    ctx.save();
    ctx.globalAlpha = 0;
    const warmTexts = ['PERFECT!', '+1 LIFE', 'SAVED!', '100',
                        '\u2665\u2665\u2665', '\u2B24 \u25CB'];
    const warmFonts = [
        [800, [16, 13, 38, 12, 11]],
        [700, [10]],
        [600, [14]],
    ];
    warmFonts.forEach(function (wf) {
        wf[1].forEach(function (sz) {
            ctx.font = wf[0] + ' ' + (sz * S) + 'px -apple-system, system-ui, sans-serif';
            warmTexts.forEach(function (t) { ctx.fillText(t, 0, 0); });
        });
    });
    ctx.font = (14 * S) + 'px -apple-system, system-ui, sans-serif';
    ctx.fillText('\u2665\u2665\u2665', 0, 0);
    ctx.restore();
}

/**
 * genPlat(prev, jumpN) — Generates a platform for jump number jumpN.
 *
 * Uses getDifficulty(jumpN) for scaled ranges. Confidence traps bump
 * the difficulty by ~15 jumps ahead of schedule for one platform.
 * Upward platforms still get a reduced max gap so the jump stays possible.
 */
function genPlat(prev, jumpN) {
    let d = getDifficulty(jumpN);

    if (isConfidenceTrap(jumpN)) {
        const harder = getDifficulty(jumpN + 15);
        d = { minGap: harder.minGap, maxGap: harder.maxGap,
              minDY: harder.minDY, maxDY: harder.maxDY,
              platMin: harder.platMin, platMax: harder.platMax };
    }

    const dy = rand(d.minDY, d.maxDY) * S;
    const upPenalty = Math.max(0, -dy / S);
    const gapMax = Math.max(d.minGap + 15, d.maxGap - upPenalty * 1.8);
    const gap = rand(d.minGap, gapMax) * S;
    const w = rand(d.platMin, d.platMax) * S;
    let y = prev.y + dy;
    y = clamp(y, H * GENERATION.minY, H * GENERATION.maxY);
    return { x: prev.x + prev.w + gap, y, w };
}

/**
 * ensurePlatforms(camX) — Generates platforms until they extend well past the
 * right edge of the visible screen. Called after landing and during init so
 * the player can always see (and potentially land on) platforms ahead.
 * platforms.length doubles as the jump number for the next platform.
 */
function ensurePlatforms(camX) {
    const rightEdge = camX + W + 400 * S;
    while (platforms[platforms.length - 1].x < rightEdge) {
        platforms.push(genPlat(platforms[platforms.length - 1], platforms.length));
    }
}

/**
 * setCamTarget() — Calculates where the camera should move to.
 *
 * Centers the pair of platforms (current + next) horizontally on
 * screen, so only two platforms are visible at any given time.
 */
function setCamTarget() {
    const cur = platforms[player.platIdx];
    const next = platforms[player.platIdx + 1];
    if (!next) {
        cam.target = cur.x + cur.w / 2 - W / 2;
        return;
    }
    cam.target = (cur.x + next.x + next.w) / 2 - W / 2;
}

function startPan() {
    cam.start = cam.x;
    setCamTarget();
    cam.progress = 0;
    const dist = Math.abs(cam.target - cam.start);
    cam.dur = clamp(dist / (W * 1.1), GAMEPLAY.cameraPanMin, GAMEPLAY.cameraPanMax);
}

/* ════════════════════════════════════════════════════════
   UPDATE — Runs every frame to advance game logic
   ════════════════════════════════════════════════════════ */

/**
 * update(dt) — Main game logic tick. dt = seconds since last frame.
 *
 * Handles: power charging, physics (gravity + movement), collision
 * detection for landing on platforms, fall detection, camera panning,
 * and cleanup of expired effects.
 */
function update(dt) {
    if (dt > 0.1) dt = 0.1; // Cap delta to prevent huge jumps after tab-switch
    if (state === 'gameover') {
        if (hudFadeAlpha > 0) hudFadeAlpha = Math.max(0, hudFadeAlpha - dt * 10);
        return;
    }

    // ── Charging: increase power while holding ──
    if (state === 'charging') {
        power = Math.min(1, power + dt / PHYSICS.chargeTime);
    }

    if (wowTimer > 0) wowTimer = Math.max(0, wowTimer - dt);
    if (nearMissShake > 0) nearMissShake = Math.max(0, nearMissShake - dt);
    if (smileTimer > 0 && smileTimer !== Infinity) smileTimer = Math.max(0, smileTimer - dt);

    // ── Physics: apply gravity and movement when airborne ──
    if (state === 'jumping' || state === 'falling') {
        const prevY = player.y; // Save Y before movement for crossing-detection
        player.vy += PHYSICS.gravity * S * dt;  // Gravity pulls down
        player.x += player.vx * dt;              // Move right
        player.y += player.vy * dt;              // Move vertically

        const cw = THEME.character.width * S;
        const ch = THEME.character.height * S;
        const centerX = player.x + cw / 2;  // Character's horizontal center
        const bottom = player.y + ch;         // Character's feet (bottom edge)
        const prevBottom = prevY + ch;         // Feet position BEFORE this frame's movement
        if (state === 'jumping' && player.vy > 0) { // Only check landing while falling down
            /*
             * LANDING ON CURRENT PLATFORM (same platform — short/failed jump)
             * If the player does a tiny jump and lands back where they started,
             * they survive but it resets the perfect streak.
             */
            const cur = platforms[player.platIdx];
            const curY = getY(cur);
            if (centerX >= cur.x && centerX <= cur.x + cur.w &&
                prevBottom <= curY + 2 * S && bottom >= curY - 2 * S &&
                bottom <= curY + Math.max(Math.abs(player.vy * dt), 8 * S)) {
                player.y = curY - ch;
                player.vx = 0; player.vy = 0;
                streak = 0; achieveStreak = 0;
                if (smileTimer === Infinity) smileTimer = 0.15;
                sfxLand();
                if (inputBuffer) {
                    state = 'charging'; power = 0; inputBuffer = false;
                } else {
                    state = 'idle';
                }
                return;
            }

            /*
             * LANDING ON THE NEXT PLATFORM — only platIdx+1 is a valid target
             * since only two platforms are visible at a time.
             */
            const ni = player.platIdx + 1;
            if (ni < platforms.length) {
                const np = platforms[ni];
                const npY = getY(np);
                const tolerance = Math.max(Math.abs(player.vy * dt), 8 * S);
                if (centerX >= np.x && centerX <= np.x + np.w &&
                    prevBottom <= npY + 2 * S && bottom >= npY - 2 * S &&
                    bottom <= npY + tolerance) {
                    onLand(np, ni);
                    return;
                }
            }
        }

        if (bottom > H + 100 * S) {
            missedJump = true;
            var failJump = GAMEPLAY.totalJumps - score.remaining + 1;
            var failRunTime = Math.round((Date.now() - runStartTime) / 100) / 10;
            var hadLife = lives > 0;
            trackJumpFail(failJump, score.remaining, hadLife, lives, failRunTime, attempts.active);
            if (lives > 0) {
                lives--;
                sfxLoseLife();
                respawn();
            } else {
                trackGameEnd(GAMEPLAY.totalJumps - score.remaining, 'fail', attempts.active, failRunTime, 0, maxStreak, totalPerfects, totalLivesGained);
                state = 'gameover';
                sfxGameOver();
                showGameOver();
            }
        }
    }

    // ── Land pause: brief freeze before camera pans ──
    if (state === 'landed') {
        landTimer -= dt;
        if (landTimer <= 0) {
            startPan();
            state = 'panning';
        }
    }

    // ── Camera pan animation (smooth ease-out slide after landing) ──
    // Runs independently of state so charging mid-pan doesn't freeze the camera
    if (cam.progress < 1) {
        cam.progress += dt / cam.dur;
        if (cam.progress >= 1) {
            cam.progress = 1;
            cam.x = cam.target;
            fadeOutIdx = -1;
            if (state === 'panning') state = 'idle';
        } else {
            cam.x = cam.start + (cam.target - cam.start) * easeOut(cam.progress);
        }
    }

    // ── Cleanup expired floating text messages (swap-and-pop) ──
    for (let i = floats.length - 1; i >= 0; i--) {
        floats[i].age += dt;
        if (floats[i].age >= floats[i].dur) {
            floats[i] = floats[floats.length - 1];
            floats.pop();
        }
    }

    // ── Ring pulse ──
    if (ringPulse) {
        ringPulse.age += dt;
        if (ringPulse.age >= ringPulse.dur) ringPulse = null;
    }
}

/**
 * onLand(plat, targetIdx) — Called when the player successfully lands on a platform.
 *
 * targetIdx is the index in the platforms array. If the player skipped platforms
 * (e.g. landed on platIdx+2), the skipped count is deducted from the score.
 * Also snaps the player, checks for perfect landing, spawns effects, and
 * starts the camera pan animation.
 */
function onLand(plat, targetIdx) {
    const ch = THEME.character.height * S;
    const cw = THEME.character.width * S;

    // How many platforms were covered (1 = normal, 2+ = skipped)
    const jumpsUsed = targetIdx - player.platIdx;

    const platY = getY(plat);

    // Track the platform we're leaving so it can fade out during the pan
    fadeOutIdx = player.platIdx;

    // Snap player to the platform surface
    player.y = platY - ch;
    player.vx = 0; player.vy = 0;
    player.platIdx = targetIdx;

    firstJump = false;
    try { localStorage.setItem('100j_played', '1'); } catch (_) {}

    var justCompleted = false;
    score.remaining -= jumpsUsed;
    if (score.remaining <= 0) {
        score.remaining = 0;
        completed = true;
        justCompleted = true;
    }

    const cx = player.x + cw / 2;
    const pcx = plat.x + plat.w / 2;
    const range = plat.w * GAMEPLAY.perfectZone / 2;
    var isPerfect = Math.abs(cx - pcx) <= range;

    if (isPerfect) {
        streak++;
        achieveStreak++;
        allPerfect++;
        totalPerfects++;
        if (achieveStreak > maxStreak) maxStreak = achieveStreak;
        smileTimer = Infinity;
        var isLifeGain = streak >= GAMEPLAY.perfectsForLife;
        var pulseColor = isLifeGain ? '#FFD700' : THEME.ui.perfectColor;
        ringPulse = { x: cx, y: player.y + ch / 2, color: pulseColor, age: 0, dur: 0.45, maxR: 40 * S };
        unlockAchievement('bullseye');
        if (achieveStreak >= 3) unlockAchievement('triplePerfect');
        if (achieveStreak >= 10) unlockAchievement('tenPerfects');
        if (justCompleted) unlockAchievement('cleanFinish');
        if (justCompleted && allPerfect >= 5) unlockAchievement('perfectFinish');
        if (isLifeGain) {
            lives++;
            streak = 0;
            totalLivesGained++;
            addFloat('+1 LIFE', cx, platY - 30 * S, '#FFD700', 16, 1.0);
            sfxLife();
        } else {
            addFloat('PERFECT!', cx, platY - 30 * S, THEME.ui.perfectColor, 16, 1.0);
            sfxPerfect(streak);
        }
    } else {
        allPerfect = 0;
        streak = 0; achieveStreak = 0;
        if (smileTimer === Infinity) smileTimer = 0.15;
        var distLeft = cx - plat.x;
        var distRight = plat.x + plat.w - cx;
        if (Math.min(distLeft, distRight) < plat.w * 0.12) {
            wowTimer = 1.2;
            wowEdgeDir = distLeft < distRight ? -1 : 1;
            nearMissShake = 0.45;
        }
        sfxLand();
    }

    var currentProgress = GAMEPLAY.totalJumps - score.remaining;
    if (currentProgress > gameStats.allTime.bestScore) {
        gameStats.allTime.bestScore = currentProgress;
        newHighScore = true;
    }
    if (currentProgress > gameStats.currentRun.bestScore) gameStats.currentRun.bestScore = currentProgress;
    saveGameStats();

    if (currentProgress >= 1) unlockAchievement('firstSteps');
    if (score.remaining <= 50) unlockAchievement('onARoll');

    if (justCompleted) {
        if (!gameStats.allTime.bestAttempts || attempts.active < gameStats.allTime.bestAttempts) {
            gameStats.allTime.bestAttempts = attempts.active;
        }
        unlockAchievement('beatGame');
        if (attempts.active <= 100) unlockAchievement('steadyHands');
        if (attempts.active <= 20) unlockAchievement('underPressure');
        if (!missedJump) unlockAchievement('untouchable');
        saveGameStats();
        showWin();
    }

    ensurePlatforms(plat.x);

    startPan();
    if (inputBuffer) {
        state = 'charging'; power = 0; inputBuffer = false;
    } else {
        state = 'panning';
    }
    saveState();
}

/**
 * respawn() — Teleports the player back to their current platform after
 * using a life. Resets velocity and state so they can try the jump again.
 */
function respawn() {
    const p = platforms[player.platIdx];
    const cw = THEME.character.width * S;
    const ch = THEME.character.height * S;
    player.x = p.x + p.w * 0.4 - cw / 2;
    player.y = getY(p) - ch;
    player.vx = 0; player.vy = 0;
    state = 'idle'; power = 0;
    streak = 0; achieveStreak = 0;
    addFloat('-1 LIFE', player.x + cw / 2, player.y - 10 * S, THEME.ui.lifeColor, 16, 1.3);
}

/* ════════════════════════════════════════════════════════
   RENDER — Drawing functions (called every frame)
   ════════════════════════════════════════════════════════ */

/** render() — Master draw function. Clears the screen and draws everything in order. */
function render() {
    drawBackground();
    // Previous platforms — draw all that are still on screen to show the path
    for (var pi = player.platIdx - 1; pi >= 0; pi--) {
        var sx = platforms[pi].x - cam.x;
        if (sx + platforms[pi].w < -30) break;
        drawPlatform(platforms[pi]);
    }

    // Current platform
    drawPlatform(platforms[player.platIdx]);

    // Next platform — drops in from above with a subtle bounce during pan
    if (player.platIdx + 1 < platforms.length) {
        if (fadeOutIdx >= 0 && cam.progress < 1) {
            var t = easeOut(cam.progress);
            var dropOffset = (1 - t) * H * 0.4;
            ctx.save();
            ctx.translate(0, -dropOffset);
            drawPlatform(platforms[player.platIdx + 1]);
            ctx.restore();
        } else {
            drawPlatform(platforms[player.platIdx + 1]);
        }
    }
    drawRingPulse();
    drawCharacter();
    drawHUD();
    drawFloats();
    if (firstJump && state === 'idle') drawHint();
}

/** Fills the canvas with the background colour. To change it, update the hex value here. */
function drawBackground() {
    ctx.fillStyle = THEME.background;
    ctx.fillRect(0, 0, W, H);
}

/**
 * ── PLATFORM DRAWING ──
 * Replace this function to use custom platform art (e.g. images/sprites).
 * Each platform p has: { x, y, w } in world-pixel coordinates.
 * Convert to screen coords with: screenX = p.x - cam.x
 */
function drawPlatform(p) {
    const sx = p.x - cam.x;
    if (sx + p.w < -30 || sx > W + 30) return;
    const py = getY(p);
    const h = THEME.platform.height * S;
    const r = 3.5 * S;
    ctx.fillStyle = THEME.platform.color;
    ctx.beginPath(); rr(ctx, sx, py, p.w, h, r); ctx.fill();
}

/**
 * ── CHARACTER DRAWING ──
 * Replace this function to use a sprite sheet. Currently draws a rounded
 * square with googly eyes. The character squishes/stretches based on state:
 *   - Charging: squishes down (wider + shorter) proportional to power
 *   - Jumping up: stretches tall and thin
 *   - Falling down: squishes wide
 *
 * The transform origin is at the character's bottom-center (feet),
 * so squishing makes them compress downward naturally.
 */
function drawCharacter() {
    const cw = THEME.character.width * S;
    const ch = THEME.character.height * S;
    const sx = player.x - cam.x; // World → screen x
    const sy = player.y;

    ctx.save();
    // Move origin to bottom-center of character (feet position)
    ctx.translate(sx + cw / 2, sy + ch);

    // Calculate squish/stretch based on current state
    let scX = 1, scY = 1;
    if (state === 'maxpause') {
        scX = 1.52; scY = 0.48;   // Held at full squish during the pause
    } else if (state === 'charging') {
        scX = 1 + power * 0.52;   // Wider as power builds
        scY = 1 - power * 0.52;   // Shorter as power builds (nearly flat at full)
    } else if (state === 'jumping' || state === 'falling') {
        if (player.vy < 0) { scX = 0.84; scY = 1.16; }  // Rising: tall & thin
        else { scX = 1.1; scY = 0.9; }                    // Falling: wide & short
    }
    ctx.scale(scX, scY);

    // Near-miss wobble: damped oscillation that shakes side to side
    if (nearMissShake > 0) {
        const shakeDur = 0.45;
        const t = 1 - nearMissShake / shakeDur;
        const decay = 1 - t;
        const angle = Math.sin(t * Math.PI * 8) * decay * 0.18;
        ctx.rotate(angle);
    }

    // Body
    ctx.fillStyle = THEME.character.color;
    ctx.beginPath();
    rr(ctx, -cw / 2, -ch, cw, ch, 5.5 * S);
    ctx.fill();

    // Eyes — positioned at 58% up from the bottom, spaced 20% from center
    const es = 3.7 * S;   // Eye radius
    const ey = -ch * 0.58; // Eye y position
    const esp = cw * 0.2;  // Eye spacing from center
    // Pupils look in the direction of movement
    const lookX = (state === 'jumping' || state === 'charging' || state === 'falling') ? 1.3 * S : 0.5 * S;
    const lookY = (state === 'jumping' && player.vy < 0) ? -0.5 * S : 0.3 * S;

    // Eye whites
    ctx.fillStyle = THEME.character.eyeWhite;
    ctx.beginPath(); ctx.arc(-esp, ey, es, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(esp, ey, es, 0, Math.PI * 2); ctx.fill();

    // Pupils
    ctx.fillStyle = THEME.character.pupil;
    ctx.beginPath(); ctx.arc(-esp + lookX, ey + lookY, es * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(esp + lookX, ey + lookY, es * 0.5, 0, Math.PI * 2); ctx.fill();

    // Mouth — neutral line, smile on perfect, O on close-edge
    const mouthY = -ch * 0.24;
    const mouthW = cw * 0.15;
    ctx.strokeStyle = THEME.character.pupil;
    ctx.lineCap = 'round';
    if (wowTimer > 0) {
        var wowT = Math.min(1, wowTimer / 0.12);
        var oR = 1.8 * S * wowT;
        ctx.fillStyle = THEME.character.pupil;
        ctx.beginPath();
        ctx.arc(0, mouthY + 1 * S, oR, 0, Math.PI * 2);
        ctx.fill();
    } else {
        var smileDrop = smileTimer > 0 ? Math.min(1, smileTimer / 0.15) * 3.5 * S : 0;
        ctx.lineWidth = 1.4 * S;
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.quadraticCurveTo(0, mouthY + smileDrop, mouthW, mouthY);
        ctx.stroke();
    }

    ctx.restore();
}


/** Draws the score, lives (hearts), and perfect streak dots. */
function drawHUD() {
    if (state === 'gameover' && hudFadeAlpha <= 0) return;
    if (winHudMode) return;

    ctx.save();
    if (state === 'gameover') ctx.globalAlpha = hudFadeAlpha;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let scoreBottom = safeTop + 30 * S;

    ctx.font = fonts.score;
    ctx.fillStyle = THEME.ui.scoreColor;
    ctx.fillText(score.remaining, W / 2, scoreBottom);
    scoreBottom += 40 * S;
    ctx.font = fonts.subtitle;
    ctx.fillStyle = THEME.ui.dimColor;
    ctx.fillText('jumps remaining', W / 2, scoreBottom);
    scoreBottom += 14 * S;

    if (lives > 0) {
        ctx.font = fonts.lives;
        ctx.fillStyle = THEME.ui.lifeColor;
        ctx.fillText('\u2665'.repeat(lives), W / 2, scoreBottom);
        scoreBottom += 20 * S;
    }

    if (streak > 0 && streak < GAMEPLAY.perfectsForLife) {
        ctx.font = fonts.streak;
        ctx.textAlign = 'left';
        const dotSpacing = ctx.measureText('\u2B24 ').width;
        const totalW = dotSpacing * GAMEPLAY.perfectsForLife - ctx.measureText(' ').width;
        let dx = W / 2 - totalW / 2;
        for (let i = 0; i < GAMEPLAY.perfectsForLife; i++) {
            ctx.fillStyle = i < streak ? THEME.ui.perfectColor : THEME.ui.streakInactive;
            ctx.fillText(i < streak ? '\u2B24' : '\u25CB', dx, scoreBottom);
            dx += dotSpacing;
        }
        ctx.textAlign = 'center';
    }

    ctx.restore();
}

function drawRingPulse() {
    if (!ringPulse) return;
    const t = ringPulse.age / ringPulse.dur;
    const r = ringPulse.maxR * easeOut(t);
    const alpha = 1 - t;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ringPulse.color;
    ctx.lineWidth = (3 - 2 * t) * S;
    ctx.beginPath();
    ctx.arc(ringPulse.x - cam.x, ringPulse.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

/**
 * Draws floating text messages that drift upward and fade out.
 * Used for "PERFECT!", "+1 LIFE", "SAVED!" feedback.
 */
function drawFloats() {
    for (const f of floats) {
        const t = f.age / f.dur; // 0→1 progress through the float's lifetime
        // Quick fade in (first 12%), then gradual fade out
        const alpha = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88);
        const yOff = -28 * S * t; // Drift upward over time
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = f.fontStr || (f.fontStr = '800 ' + (f.size * fonts.floatPx) + 'px -apple-system, system-ui, sans-serif');
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x - cam.x, f.y + yOff);
    }
    ctx.globalAlpha = 1;
}

/** Hint text shown only before the player's first jump. */
function drawHint() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fonts.hint;
    ctx.fillStyle = THEME.ui.hintColor;
    var hintMsg = hasKeyboard ? 'Hold spacebar, then release to jump' : 'Long tap, then release to jump';
    if (hasKeyboard) {
        ctx.textBaseline = 'bottom';
        ctx.fillText(hintMsg, player.x + THEME.character.width * S / 2 - cam.x, player.y - 18 * S);
    } else {
        ctx.fillText(hintMsg, W / 2, H * 0.3);
    }
}

/* ════════════════════════════════════════════════════════
   OVERLAYS — HTML modal popups for Game Over and Win
   ════════════════════════════════════════════════════════ */

/** Shows the Game Over popup with the player's progress. */
function showGameOver() {
    winModalOpen = false;
    winHudMode = false;
    clearSavedState();
    const done = GAMEPLAY.totalJumps - score.remaining;
    document.getElementById('av-body').setAttribute('fill', LEVELS[activeLevel].color);
    mAvatar.style.display = 'block';
    setAvatarFace('sad');
    mBrand.textContent = '';
    mBrand.style.display = 'none';
    mTitle.textContent = 'Game Over';
    mSub.innerHTML = 'You survived<br>' + done + ' of ' + GAMEPLAY.totalJumps + ' jumps';
    mDetail.textContent = '';
    mDetail.style.display = 'none';
    mBtn.innerHTML = 'Retry';
    mBtn.onclick = restart;
    document.getElementById('mb-levels').style.display = '';
    modal.classList.add('show');
}

/** Shows the Congratulations popup when the player reaches 0 remaining. */
var winModalOpen = false;
function showWin() {
    sfxWin();
    var winRunTime = Math.round((Date.now() - runStartTime) / 100) / 10;
    trackGameEnd(GAMEPLAY.totalJumps, 'complete', attempts.active, winRunTime, lives, maxStreak, totalPerfects, totalLivesGained);
    clearSavedState();
    winModalOpen = true;
    winHudMode = true;
    document.getElementById('av-body').setAttribute('fill', LEVELS[activeLevel].color);
    mAvatar.style.display = 'block';
    setAvatarFace('happy');
    mBrand.textContent = '';
    mBrand.style.display = 'none';
    mTitle.textContent = 'You completed 100 jumps!';
    mSub.textContent = attempts.active + (attempts.active === 1 ? ' attempt' : ' attempts');
    mDetail.textContent = '';
    mDetail.style.display = 'none';
    document.getElementById('mb-levels').style.display = 'none';
    mBtn.textContent = 'Play Again for Trophies';
    mBtn.onclick = function () {
        gameStats.currentRun = { bestScore: 0, jumpsAttempted: 0, successfulLands: 0 };
        saveGameStats();
        attempts.active = 0;
        saveAttempts();
        modal.classList.remove('show');
        winModalOpen = false;
        winHudMode = false;
        restart();
        setTimeout(function () {
            statsOpen = true;
            renderStats();
            statsOverlay.classList.add('show');
        }, 400);
    };
    modal.classList.add('show');
}

/** Saves current game state to sessionStorage so a page refresh resumes play. */
function saveState() {
    try {
        sessionStorage.setItem('100j', JSON.stringify({
            platforms, player, cam, score, state: 'idle',
            streak, achieveStreak, lives, completed, firstJump,
            missedJump, allPerfect, newHighScore,
        }));
    } catch (_) { /* quota exceeded or private browsing — ignore */ }
}

/** Attempts to restore a saved session. Returns true if successful. */
function restoreState() {
    try {
        const raw = sessionStorage.getItem('100j');
        if (!raw) return false;
        const s = JSON.parse(raw);
        if (!s.platforms || !s.player) return false;

        resize();
        platforms = s.platforms;
        player = s.player;
        cam = s.cam;
        cam.progress = 1;
        score = s.score;
        state = s.state || 'idle';
        streak = s.streak || 0;
        achieveStreak = s.achieveStreak || 0;
        lives = s.lives || 0;
        completed = !!s.completed;
        firstJump = !!s.firstJump;
        missedJump = !!s.missedJump;
        allPerfect = s.allPerfect || 0;
        newHighScore = !!s.newHighScore;
        power = 0; landTimer = 0; lastTS = 0; fadeOutIdx = -1;
        hudFadeAlpha = 1; winHudMode = false; smileTimer = 0; wowTimer = 0; wowEdgeDir = 1; nearMissShake = 0; inputBuffer = false;
        floats = []; ringPulse = null;
        runSeed = runSeed || Math.random().toString(36).substr(2, 8);
        runStartTime = runStartTime || Date.now();
        maxStreak = maxStreak || 0;
        totalPerfects = totalPerfects || 0;
        totalLivesGained = totalLivesGained || 0;

        // Rescale all positions from saved dimensions to current screen
        const savedW = platforms[0] ? platforms[0].x / (25) : S;
        // Positions were stored in absolute pixels — they'll match if screen
        // size hasn't changed. If it has, the next resize() event will fix it.

        modal.classList.remove('show');
        ensurePlatforms(cam.x);
        setCamTarget();
        cam.x = cam.target;
        player.y = getY(platforms[player.platIdx]) - THEME.character.height * S;
        return true;
    } catch (_) {
        return false;
    }
}

/** Clears saved state (called on game over or explicit restart). */
function clearSavedState() {
    try { sessionStorage.removeItem('100j'); } catch (_) {}
}

/** Full game reset — re-runs init() and resets the frame timer. */
function restart() {
    clearSavedState();
    init();
    lastTS = 0;
}

/* ════════════════════════════════════════════════════════
   EFFECTS — Floating text helpers
   ════════════════════════════════════════════════════════ */

/** Creates a floating text message at a world position. */
function addFloat(text, x, y, color, size, dur) {
    floats.push({ text, x, y, color, size, dur, age: 0 });
}

/* ════════════════════════════════════════════════════════
   INPUT — Touch and mouse event handlers
   ════════════════════════════════════════════════════════
   The game uses a simple hold-and-release mechanic:
   - Press/touch down → start charging (if idle or panning)
   - Release → fire the jump with accumulated power
   - Tap during gameover → restart immediately
   - Modal blocks input when visible
 */

function onDown(e) {
    e.preventDefault();
    initAudio();
    if (state === 'gameover') { restart(); return; }  // Tap anywhere to restart
    if (modal.classList.contains('show')) return;
    if (settingsOpen || statsOpen || levelSelectOpen) return;
    if (state === 'idle' || state === 'panning' || state === 'landed') {
        if (state === 'landed') {
            startPan();
        }
        state = 'charging';
        power = 0;
    } else if (state === 'jumping') {
        inputBuffer = true;
    }
}

function onUp(e) {
    e.preventDefault();
    if (state !== 'charging') { inputBuffer = false; return; }

    const cw = THEME.character.width * S;
    const ch = THEME.character.height * S;

    if (power >= 0.98) {
        addFloat('Really?', player.x + cw / 2, player.y - 10 * S, '#64748b', 14, 1.4);
        state = 'maxpause';
        power = 0;
        setTimeout(function () {
            if (state !== 'maxpause') return;
            sfxJump();
            unlockAchievement('fullSend');
            player.vx = PHYSICS.maxVX * S;
            player.vy = -(PHYSICS.minVY + (PHYSICS.maxVY - PHYSICS.minVY)) * S;
            state = 'jumping';
        }, 850);
        return;
    }

    sfxJump();

    const pw = Math.max(PHYSICS.minPower, power);
    player.vx = pw * PHYSICS.maxVX * S;
    player.vy = -(PHYSICS.minVY + pw * (PHYSICS.maxVY - PHYSICS.minVY)) * S;

    state = 'jumping';
    power = 0;
}

// Mouse events (desktop)
cv.addEventListener('mousedown', onDown);
cv.addEventListener('mouseup', onUp);
cv.addEventListener('mouseleave', onUp); // Release if cursor leaves canvas

// Touch events (mobile) — passive:false so preventDefault() works
cv.addEventListener('touchstart', onDown, { passive: false });
cv.addEventListener('touchend', onUp, { passive: false });
cv.addEventListener('touchcancel', onUp, { passive: false });

// Prevent pull-to-refresh and scroll on mobile
document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

// Prevent double-tap zoom on mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, { passive: false });

// Tap anywhere on the modal overlay to dismiss (game over only, not win)
modal.addEventListener('click', function (e) {
    if (e.target.id === 'mb-levels') return;
    if (modal.classList.contains('show') && !winModalOpen) mBtn.click();
});
modal.addEventListener('touchend', function (e) {
    if (e.target.id === 'mb-levels') return;
    if (modal.classList.contains('show') && !winModalOpen) { e.preventDefault(); mBtn.click(); }
}, { passive: false });

settingsHandler(document.getElementById('mb-levels'), function () {
    modal.classList.remove('show');
    showLevelSelect();
});

// Keyboard events (desktop) — spacebar acts as hold-to-charge, release-to-jump
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        if (window.parent !== window) window.parent.postMessage('close-game', '*');
        return;
    }
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;
    if (settingsOpen || statsOpen || levelSelectOpen) return;
    if (modal.classList.contains('show')) {
        if (!winModalOpen) mBtn.click();
        return;
    }
    onDown(e);
});
document.addEventListener('keyup', function (e) {
    if (e.code !== 'Space') return;
    onUp(e);
});

// Recalculate canvas size on window resize or orientation change
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', function () {
    setTimeout(resize, 100); // Slight delay so the browser has applied the new dimensions
});

/* ════════════════════════════════════════════════════════
   SETTINGS UI — Cog button and settings overlay
   ════════════════════════════════════════════════════════ */
var settingsOpen = false;
var settingsOverlay = document.getElementById('settings-overlay');
var togSound = document.getElementById('tog-sound');
var togVib = document.getElementById('tog-vib');
var togDark = document.getElementById('tog-dark');
var volSlider = document.getElementById('vol-slider');
var volRow = document.getElementById('vol-row');

function syncToggles() {
    togSound.classList.toggle('on', settings.sound);
    togVib.classList.toggle('on', settings.vibration);
    togDark.classList.toggle('on', settings.darkMode);
    volSlider.value = Math.round(settings.volume * 50);
    volRow.style.display = settings.sound ? 'flex' : 'none';
}
syncToggles();

var volPreviewTimer = null;
volSlider.addEventListener('input', function (e) {
    e.stopPropagation();
    settings.volume = parseInt(volSlider.value, 10) / 50;
    saveSettings();
    initAudio();
    clearTimeout(volPreviewTimer);
    volPreviewTimer = setTimeout(function () {
        playTone(523, 'sine', 0.1, 0.25);
    }, 80);
});
volSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: false });
volSlider.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: false });
volSlider.addEventListener('touchend', function (e) { e.stopPropagation(); }, { passive: false });

function settingsHandler(el, fn) {
    el.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    el.addEventListener('touchend', function (e) {
        e.preventDefault(); e.stopPropagation(); fn();
    }, { passive: false });
}

settingsHandler(document.getElementById('settings-btn'), function () {
    settingsOpen = true;
    settingsOverlay.classList.add('show');
});

settingsHandler(document.getElementById('settings-done'), function () {
    settingsOpen = false;
    settingsOverlay.classList.remove('show');
});

settingsOverlay.addEventListener('click', function (e) {
    if (e.target === settingsOverlay) {
        settingsOpen = false;
        settingsOverlay.classList.remove('show');
    }
});
settingsOverlay.addEventListener('touchend', function (e) {
    if (e.target === settingsOverlay) {
        e.preventDefault();
        settingsOpen = false;
        settingsOverlay.classList.remove('show');
    }
}, { passive: false });

settingsHandler(togSound, function () {
    settings.sound = !settings.sound;
    syncToggles();
    saveSettings();
});

settingsHandler(togVib, function () {
    settings.vibration = !settings.vibration;
    syncToggles();
    saveSettings();
});

settingsHandler(togDark, function () {
    settings.darkMode = !settings.darkMode;
    applyTheme(settings.darkMode);
    syncToggles();
    saveSettings();
});

/* ════════════════════════════════════════════════════════
   STATS UI — Trophy button and stats overlay
   ════════════════════════════════════════════════════════ */
var statsOpen = false;
var statsOverlay = document.getElementById('stats-overlay');

statsOverlay.querySelector('.card').addEventListener('touchmove', function (e) {
    e.stopPropagation();
}, { passive: true });

function formatBestScore(best) {
    if (best === 0) return '–';
    if (best >= GAMEPLAY.totalJumps) return '0 left';
    return (GAMEPLAY.totalJumps - best) + ' left';
}

var activeTooltipTimer = null;

function renderStats() {
    document.getElementById('stats-title').textContent = 'Stats';
    var atGrid = document.getElementById('stat-at-attempts').closest('.stats-grid');
    var atBestWrap = document.getElementById('stat-at-best-wrap');
    if (gameStats.allTime.bestAttempts > 0) {
        atGrid.style.gridTemplateColumns = '1fr';
        atBestWrap.style.display = 'none';
        document.getElementById('stat-at-attempts').textContent = gameStats.allTime.bestAttempts;
        atGrid.querySelector('.stat-label').textContent = 'Fewest Attempts';
    } else {
        atGrid.style.gridTemplateColumns = '1fr 1fr';
        atBestWrap.style.display = '';
        document.getElementById('stat-at-attempts').textContent = attempts.total;
        atGrid.querySelector('.stat-label').textContent = 'Attempts';
        document.getElementById('stat-at-best').textContent = formatBestScore(gameStats.allTime.bestScore);
        atBestWrap.querySelector('.stat-label').textContent = 'Best';
    }

    var runSection = document.getElementById('stats-run-section');
    if (gameStats.achievements.beatGame) {
        runSection.style.display = '';
        document.getElementById('stat-cr-attempts').textContent = attempts.active;
        document.getElementById('stat-cr-best').textContent = formatBestScore(gameStats.currentRun.bestScore);
    } else {
        runSection.style.display = 'none';
    }

    var grid = document.getElementById('trophy-grid');
    grid.innerHTML = '';
    TROPHIES.forEach(function (t) {
        var unlocked = !!gameStats.achievements[t.id];
        var el = document.createElement('div');
        el.className = 'trophy-item' + (unlocked ? ' unlocked' : '');
        el.innerHTML = '<div class="trophy-icon">' + t.icon + '</div>' +
            '<div class="trophy-name">' + t.name + '</div>' +
            '<div class="trophy-tooltip">' + t.desc + '</div>';
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            var tip = el.querySelector('.trophy-tooltip');
            var allTips = grid.querySelectorAll('.trophy-tooltip.visible');
            for (var i = 0; i < allTips.length; i++) allTips[i].classList.remove('visible');
            tip.classList.add('visible');
            clearTimeout(activeTooltipTimer);
            activeTooltipTimer = setTimeout(function () { tip.classList.remove('visible'); }, 1800);
        });
        grid.appendChild(el);
    });
}

settingsHandler(document.getElementById('stats-btn'), function () {
    statsOpen = true;
    renderStats();
    statsOverlay.classList.add('show');
});

settingsHandler(document.getElementById('stats-done'), function () {
    statsOpen = false;
    statsOverlay.classList.remove('show');
});


statsOverlay.addEventListener('click', function (e) {
    if (e.target === statsOverlay) {
        statsOpen = false;
        statsOverlay.classList.remove('show');
    }
});
statsOverlay.addEventListener('touchend', function (e) {
    if (e.target === statsOverlay) {
        e.preventDefault();
        statsOpen = false;
        statsOverlay.classList.remove('show');
    }
}, { passive: false });

/* ════════════════════════════════════════════════════════
   LEVEL SELECT UI — Level picker shown on page load
   ════════════════════════════════════════════════════════ */
var levelSelectOpen = false;
var levelSelectEl = document.getElementById('level-select');
var lsImage = document.getElementById('ls-image');
var lsCharBody = document.getElementById('ls-char-body');
var lsPupilL = document.getElementById('ls-pupil-l');
var lsPupilR = document.getElementById('ls-pupil-r');
var lsLock = document.getElementById('ls-lock');
var lsTitle = document.getElementById('ls-title');
var lsDots = document.getElementById('ls-dots');
var lsPlay = document.getElementById('ls-play');
var lsPrev = document.getElementById('ls-prev');
var lsNext = document.getElementById('ls-next');
var lsViewIdx = activeLevel;

function renderLevelSelect() {
    var lvl = LEVELS[lsViewIdx];
    lsImage.style.background = 'none';
    lsCharBody.setAttribute('fill', lvl.color);
    lsPupilL.setAttribute('cx', lvl.id === 'classic' ? '15' : '20');
    lsPupilR.setAttribute('cx', lvl.id === 'classic' ? '39' : '44');
    lsTitle.textContent = lvl.name;

    var locked = !isLevelUnlocked(lvl);
    lsLock.style.display = locked ? '' : 'none';
    lsPlay.textContent = locked ? 'Locked' : 'Play Now';
    lsPlay.style.opacity = locked ? '0.45' : '1';
    lsPrev.disabled = (lsViewIdx === 0);
    lsNext.disabled = (lsViewIdx === LEVELS.length - 1);

    lsDots.innerHTML = '';
    for (var i = 0; i < LEVELS.length; i++) {
        var dot = document.createElement('div');
        dot.className = 'ls-dot' + (i === lsViewIdx ? ' active' : '');
        lsDots.appendChild(dot);
    }
}

function showLevelSelect() {
    levelSelectOpen = true;
    lsViewIdx = activeLevel;
    renderLevelSelect();
    levelSelectEl.classList.add('show');
}

function hideLevelSelect() {
    levelSelectOpen = false;
    levelSelectEl.classList.remove('show');
}

settingsHandler(lsPrev, function () {
    if (lsViewIdx > 0) { lsViewIdx--; renderLevelSelect(); }
});
settingsHandler(lsNext, function () {
    if (lsViewIdx < LEVELS.length - 1) { lsViewIdx++; renderLevelSelect(); }
});

settingsHandler(lsPlay, function () {
    var lvl = LEVELS[lsViewIdx];
    if (!isLevelUnlocked(lvl)) {
        lsPlay.style.transform = 'translateX(-4px)';
        setTimeout(function () { lsPlay.style.transform = 'translateX(4px)'; }, 80);
        setTimeout(function () { lsPlay.style.transform = ''; }, 160);
        return;
    }

    loadLevelStats(lsViewIdx);
    hideLevelSelect();
    init();
    lastTS = 0;
    requestAnimationFrame(loop);
});

/* ════════════════════════════════════════════════════════
   UTILITIES — Math helpers and drawing primitives
   ════════════════════════════════════════════════════════ */

/**
 * rr() — Traces a rounded rectangle path (does NOT fill/stroke).
 * Call ctx.fill() or ctx.stroke() after to render it.
 * The radius is automatically clamped to half the smallest dimension.
 */
function rr(c, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    if (r < 0) r = 0;
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
}

/** Returns a random float between a and b. */
function rand(a, b) { return a + Math.random() * (b - a); }

/** Clamps v between lo and hi. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Cubic ease-out curve: fast start, gentle deceleration. Used for camera pan. */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }



/* ════════════════════════════════════════════════════════
   GAME LOOP — Drives the update→render cycle via requestAnimationFrame
   ════════════════════════════════════════════════════════ */
function loop(ts) {
    if (!lastTS) lastTS = ts;
    const dt = (ts - lastTS) / 1000;
    lastTS = ts;
    update(dt);
    render();

    requestAnimationFrame(loop);
}

// Boot — restore mid-session state if available, otherwise start classic mode
resize();
if (restoreState()) {
    requestAnimationFrame(loop);
} else {
    loadLevelStats(0);
    init();
    lastTS = 0;
    requestAnimationFrame(loop);
}

// ── App download banner: iOS → App Store, Android → Play Store, Desktop → both ──
(function() {
    var banner = document.getElementById('appstore-banner');
    var closeBtn = document.getElementById('ab-close');
    var abTitle = document.getElementById('ab-title');
    var abSub = document.getElementById('ab-sub');
    var abCta = document.getElementById('ab-cta');
    if (!banner || !closeBtn) return;

    var APP_STORE = 'https://apps.apple.com/bz/app/100-jumps/id6760545256';
    var PLAY_STORE = 'https://play.google.com/store/apps/details?id=org.app_100jumps.twa';

    var ua = navigator.userAgent || '';
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isDesktop = !isAndroid && !isIOS && !/Mobile/i.test(ua);
    var isPWA = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || window.matchMedia('(display-mode: fullscreen)').matches
        || document.referrer.indexOf('android-app://') === 0;

    var footer = document.getElementById('bz-footer');
    if (footer && !isPWA) { footer.style.display = 'block'; }

    var dismissed = false;
    try { dismissed = localStorage.getItem('ab_dismissed') === '1'; } catch(e) {}

    if (isPWA || dismissed) return;

    if (isIOS) {
        abTitle.textContent = 'Get Jump Stack on App Store';
        abSub.textContent = 'Download the free iOS app';
        abCta.innerHTML = '<a class="ab-get" href="' + APP_STORE + '" target="_blank" rel="noopener">GET</a>';
    } else if (isAndroid) {
        abTitle.textContent = 'Get Jump Stack on Play Store';
        abSub.textContent = 'Download the free Android app';
        abCta.innerHTML = '<a class="ab-get" href="' + PLAY_STORE + '" target="_blank" rel="noopener">GET</a>';
    } else if (isDesktop) {
        abTitle.textContent = 'Get Jump Stack on your phone';
        abSub.textContent = 'Download the free app';
        abCta.innerHTML = '<span class="ab-buttons">'
            + '<a class="ab-get" href="' + APP_STORE + '" target="_blank" rel="noopener">iOS</a>'
            + '<a class="ab-get" href="' + PLAY_STORE + '" target="_blank" rel="noopener">Android</a>'
            + '</span>';
    } else {
        return;
    }

    setTimeout(function() { banner.classList.add('show'); }, 2000);

    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        banner.classList.remove('show');
        banner.classList.add('hide');
        try { localStorage.setItem('ab_dismissed', '1'); } catch(e) {}
    });
})();
