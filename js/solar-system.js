/**
 * Solar System Ceiling Projection
 * Heliocentric, top-down view with real planet positions
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Orbital radii in AU (astronomical units)
  planets: [
    { name: 'Mercury', au: 0.39 },
    { name: 'Venus', au: 0.72 },
    { name: 'Earth', au: 1.0 },
    { name: 'Mars', au: 1.52 },
    { name: 'Jupiter', au: 5.2 },
    { name: 'Saturn', au: 9.54 },
    { name: 'Uranus', au: 19.19 },
    { name: 'Neptune', au: 30.07 },
  ],

  // Visual scale: log-compressed radius for legibility
  // Adjust this to change spacing between orbits
  logBase: 1.5,

  // Sun visual properties
  sunRadius: 8,
  sunColor: '#FDB813',

  // Default time rate: simulated days per real second
  defaultTimeRate: 1,
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

let state = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,

  // Timing
  currentDate: new Date(),
  timeRate: CONFIG.defaultTimeRate, // simulated days per real second
  isPaused: false,
  lastFrameTime: Date.now(),

  // Stars cache
  stars: [],

  // Projection mode
  isFullscreen: false,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  state.canvas = document.getElementById('canvas');
  state.ctx = state.canvas.getContext('2d');

  resizeCanvas();
  generateStars();
  setupKeyboardControls();
  setupMouseTracking();

  // Start animation loop
  requestAnimationFrame(animate);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  state.canvas.width = state.width * dpr;
  state.canvas.height = state.height * dpr;

  state.ctx.scale(dpr, dpr);

  state.centerX = state.width / 2;
  state.centerY = state.height / 2;

  // Regenerate stars when resizing (slight performance hit but ensures coverage)
  generateStars();
}

function generateStars() {
  state.stars = [];

  // Generate a deterministic starfield based on canvas dimensions
  const seed = 42; // Fixed seed for consistency
  const numStars = 300;

  for (let i = 0; i < numStars; i++) {
    const angle = (i * 137.5 * Math.PI / 180); // Golden angle for even distribution
    const distance = Math.sqrt(i / numStars) * Math.max(state.width, state.height);

    const x = state.centerX + distance * Math.cos(angle);
    const y = state.centerY + distance * Math.sin(angle);

    // Skip if outside bounds
    if (x < -100 || x > state.width + 100 || y < -100 || y > state.height + 100) continue;

    // Brightness varies with pseudo-random
    const brightness = 0.3 + 0.7 * Math.sin(i * 137.5) * Math.sin(i * 73.3);

    state.stars.push({ x, y, brightness });
  }
}

// ============================================================================
// SCALING & POSITION CONVERSION
// ============================================================================

/**
 * Convert AU distance to canvas pixels using logarithmic scaling
 * This compresses the huge range (0.39 AU to 30 AU) into a viewable scale
 */
function auToPixels(au) {
  // Log-scaled: log(au) / log(logBase) gives a compressed distance
  const logDistance = Math.log(au) / Math.log(CONFIG.logBase);
  const maxVisibleAU = 35; // Slightly beyond Neptune
  const maxPixelRadius = Math.min(state.width, state.height) * 0.4; // Leave margin
  return (logDistance / Math.log(maxVisibleAU / CONFIG.logBase)) * maxPixelRadius;
}

// ============================================================================
// RENDERING
// ============================================================================

function drawStars() {
  state.ctx.fillStyle = '#fff';
  state.stars.forEach(star => {
    state.ctx.globalAlpha = star.brightness * 0.8;
    state.ctx.fillRect(star.x, star.y, 1, 1);
  });
  state.ctx.globalAlpha = 1.0;
}

function drawSun() {
  const x = state.centerX;
  const y = state.centerY;

  // Sun glow
  const gradient = state.ctx.createRadialGradient(x, y, 0, x, y, CONFIG.sunRadius * 3);
  gradient.addColorStop(0, 'rgba(253, 184, 19, 0.4)');
  gradient.addColorStop(1, 'rgba(253, 184, 19, 0)');
  state.ctx.fillStyle = gradient;
  state.ctx.fillRect(x - CONFIG.sunRadius * 3, y - CONFIG.sunRadius * 3,
                      CONFIG.sunRadius * 6, CONFIG.sunRadius * 6);

  // Sun body
  state.ctx.fillStyle = CONFIG.sunColor;
  state.ctx.beginPath();
  state.ctx.arc(x, y, CONFIG.sunRadius, 0, Math.PI * 2);
  state.ctx.fill();
}

function drawOrbits() {
  state.ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
  state.ctx.lineWidth = 1;

  CONFIG.planets.forEach(planet => {
    const radius = auToPixels(planet.au);
    state.ctx.beginPath();
    state.ctx.arc(state.centerX, state.centerY, radius, 0, Math.PI * 2);
    state.ctx.stroke();
  });
}

function drawPlanets(date) {
  // For phase 1, just show orbital rings. Phase 2 will add real positions.
  // This is a placeholder for planet rendering.
}

function frame() {
  // Clear canvas with dark background
  state.ctx.fillStyle = '#000';
  state.ctx.fillRect(0, 0, state.width, state.height);

  // Draw starfield
  drawStars();

  // Draw orbital rings
  drawOrbits();

  // Draw Sun
  drawSun();

  // Update info display
  updateInfoDisplay();
}

function updateInfoDisplay() {
  const dateEl = document.getElementById('dateDisplay');
  const rateEl = document.getElementById('timeRateDisplay');

  const dateStr = state.currentDate.toISOString().split('T')[0];
  dateEl.textContent = `Date: ${dateStr}`;

  const rateStr = state.isPaused ? 'PAUSED' : `${state.timeRate.toFixed(2)} d/s`;
  rateEl.textContent = `Rate: ${rateStr}`;
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
  const now = Date.now();
  const deltaTime = (now - state.lastFrameTime) / 1000; // seconds
  state.lastFrameTime = now;

  // Update simulation time
  if (!state.isPaused) {
    const simulatedDays = deltaTime * state.timeRate;
    state.currentDate = new Date(state.currentDate.getTime() + simulatedDays * 24 * 60 * 60 * 1000);
  }

  // Render frame
  frame();

  // Continue loop
  requestAnimationFrame(animate);
}

// ============================================================================
// KEYBOARD CONTROLS
// ============================================================================

function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case '+':
      case '=':
        state.timeRate *= 1.1;
        break;
      case '-':
      case '_':
        state.timeRate = Math.max(0.001, state.timeRate / 1.1);
        break;
      case ' ':
        state.isPaused = !state.isPaused;
        e.preventDefault();
        break;
      case 'n':
      case 'N':
        state.currentDate = new Date();
        state.isPaused = false;
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        e.preventDefault();
        break;
    }
  });
}

function setupMouseTracking() {
  let hideTimeout;
  function hideCursor() {
    state.canvas.style.cursor = 'none';
  }
  function showCursor() {
    state.canvas.style.cursor = 'auto';
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideCursor, 3000);
  }
  document.addEventListener('mousemove', showCursor);
}

// ============================================================================
// FULLSCREEN & PROJECTION MODE
// ============================================================================

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      state.isFullscreen = true;
      hideUI();
      requestWakeLock();
    });
  } else {
    document.exitFullscreen().then(() => {
      state.isFullscreen = false;
      showUI();
    });
  }
}

function hideUI() {
  document.getElementById('info').classList.add('hidden');
}

function showUI() {
  document.getElementById('info').classList.remove('hidden');
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      const wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake lock acquired');

      // Re-acquire if page becomes visible again
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && state.isFullscreen) {
          await navigator.wakeLock.request('screen');
        }
      });
    }
  } catch (err) {
    console.warn('Wake lock not supported:', err);
  }
}

// ============================================================================
// WINDOW RESIZE HANDLER
// ============================================================================

window.addEventListener('resize', resizeCanvas);

// ============================================================================
// START
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
