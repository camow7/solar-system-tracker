/**
 * Solar System Ceiling Projection
 * Heliocentric, top-down view with real planet positions
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Planet definitions with visual properties
  planets: [
    { name: 'Mercury', body: 'Mercury', radius: 3, color: '#8C7853' },
    { name: 'Venus', body: 'Venus', radius: 6, color: '#FFC649' },
    { name: 'Earth', body: 'Earth', radius: 6.5, color: '#4A90E2' },
    { name: 'Mars', body: 'Mars', radius: 4, color: '#E27B58' },
    { name: 'Jupiter', body: 'Jupiter', radius: 14, color: '#C88B3A' },
    { name: 'Saturn', body: 'Saturn', radius: 12, color: '#E5C55B' },
    { name: 'Uranus', body: 'Uranus', radius: 8, color: '#4FD0E7' },
    { name: 'Neptune', body: 'Neptune', radius: 8, color: '#4166F5' },
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

  // Orbit trails: { planetBody: [{ x, y, alpha }, ...] }
  trails: {},

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
  if (au === 0) return 0;
  // Log-scaled: log(au) / log(logBase) gives a compressed distance
  const logDistance = Math.log(au) / Math.log(CONFIG.logBase);
  const maxVisibleAU = 35; // Slightly beyond Neptune
  const maxPixelRadius = Math.min(state.width, state.height) * 0.4; // Leave margin
  return (logDistance / Math.log(maxVisibleAU / CONFIG.logBase)) * maxPixelRadius;
}

/**
 * Get heliocentric ecliptic position of a planet for a given date
 * Returns { angle (radians), distance (AU) } in top-down polar coordinates
 */
function getPlanetPosition(bodyName, date) {
  if (typeof Astronomy === 'undefined') {
    console.error('Astronomy engine not loaded');
    return null;
  }

  try {
    // HelioVector returns heliocentric position vector in AU
    const vector = Astronomy.HelioVector(bodyName, date);

    // Convert to top-down polar coordinates
    // x, y are in ecliptic plane; z is out of plane (ignored for top-down view)
    const au = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    const angle = Math.atan2(vector.y, vector.x);

    return { angle, au };
  } catch (err) {
    console.error(`Failed to get position for ${bodyName}:`, err);
    return null;
  }
}

/**
 * Convert polar to Cartesian coordinates on canvas
 */
function polarToCanvas(angle, au) {
  const pixelRadius = auToPixels(au);
  const x = state.centerX + pixelRadius * Math.cos(angle);
  const y = state.centerY + pixelRadius * Math.sin(angle);
  return { x, y, pixelRadius };
}

/**
 * Add a point to a planet's orbit trail
 */
function addTrailPoint(bodyName, x, y) {
  if (!state.trails[bodyName]) {
    state.trails[bodyName] = [];
  }

  state.trails[bodyName].push({ x, y });

  // Keep trail at reasonable length (e.g., last 50 points = ~5-10 frames at 60fps)
  // This gives a subtle fade trail without memory bloat
  if (state.trails[bodyName].length > 50) {
    state.trails[bodyName].shift();
  }
}

/**
 * Draw orbit trails for all planets
 */
function drawTrails() {
  state.ctx.lineWidth = 1;

  Object.entries(state.trails).forEach(([bodyName, points]) => {
    if (points.length < 2) return;

    // Draw trail as a line with fading alpha
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const alpha = (i / points.length) * 0.3; // Max 30% opacity

      state.ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
      state.ctx.beginPath();
      state.ctx.moveTo(p1.x, p1.y);
      state.ctx.lineTo(p2.x, p2.y);
      state.ctx.stroke();
    }
  });
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
  CONFIG.planets.forEach(planet => {
    const pos = getPlanetPosition(planet.body, date);
    if (!pos) return;

    const canvas = polarToCanvas(pos.angle, pos.au);

    // Add to trail (sample every few frames to reduce density)
    if (Math.random() < 0.2) { // 20% of frames add to trail
      addTrailPoint(planet.body, canvas.x, canvas.y);
    }

    // Draw planet
    state.ctx.fillStyle = planet.color;
    state.ctx.beginPath();
    state.ctx.arc(canvas.x, canvas.y, planet.radius, 0, Math.PI * 2);
    state.ctx.fill();

    // Optional: subtle outline
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    state.ctx.lineWidth = 0.5;
    state.ctx.stroke();
  });
}

function frame() {
  // Clear canvas with dark background
  state.ctx.fillStyle = '#000';
  state.ctx.fillRect(0, 0, state.width, state.height);

  // Draw starfield
  drawStars();

  // Draw orbital rings
  drawOrbits();

  // Draw orbit trails (before planets so they appear behind)
  drawTrails();

  // Draw Sun
  drawSun();

  // Draw planets
  drawPlanets(state.currentDate);

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
