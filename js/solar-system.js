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

    // Draw planet with enhanced details
    drawPlanetDetailed(planet, canvas.x, canvas.y, planet.radius);
  });
}

/**
 * Draw a planet with procedural details (bands, rings, continents, etc.)
 */
function drawPlanetDetailed(planet, x, y, radius) {
  const ctx = state.ctx;

  // Base gradient: brighter center, darker edges for depth
  const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
  gradient.addColorStop(0, lightenColor(planet.color, 0.4));
  gradient.addColorStop(0.7, planet.color);
  gradient.addColorStop(1, darkenColor(planet.color, 0.3));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Planet-specific details
  switch (planet.body) {
    case 'Jupiter':
      drawJupiter(x, y, radius);
      break;
    case 'Saturn':
      drawSaturn(x, y, radius);
      break;
    case 'Earth':
      drawEarth(x, y, radius);
      break;
    case 'Mars':
      drawMars(x, y, radius);
      break;
    case 'Venus':
      drawVenus(x, y, radius);
      break;
    case 'Uranus':
      drawUranus(x, y, radius);
      break;
    case 'Neptune':
      drawNeptune(x, y, radius);
      break;
  }

  // Subtle outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Helper: lighten a color
 */
function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.floor(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.floor(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.floor(255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Helper: darken a color
 */
function darkenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.floor(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.floor(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.floor(255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Draw Jupiter with bands
 */
function drawJupiter(x, y, radius) {
  const ctx = state.ctx;

  // Great Red Spot (simplified)
  ctx.fillStyle = 'rgba(200, 100, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.2, y + radius * 0.15, radius * 0.3, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Equatorial bands (horizontal stripes)
  const bandCount = 5;
  const bandHeight = (radius * 1.8) / bandCount;
  for (let i = 0; i < bandCount; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(100, 50, 0, 0.15)';
      ctx.fillRect(x - radius, y - radius + i * bandHeight, radius * 2, bandHeight);
    }
  }
}

/**
 * Draw Saturn with rings
 */
function drawSaturn(x, y, radius) {
  const ctx = state.ctx;

  // Rings (drawn before planet for proper z-order, then redraw planet on top)
  // Actually, we need to draw rings around the planet
  const ringRadiusOuter = radius * 2;
  const ringRadiusInner = radius * 1.3;
  const ringThickness = ringRadiusOuter - ringRadiusInner;

  // Draw ring as ellipse (tilted for perspective)
  ctx.strokeStyle = 'rgba(200, 180, 140, 0.4)';
  ctx.lineWidth = ringThickness * 0.6;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRadiusOuter, ringRadiusOuter * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Ring shadow (darker on one side)
  ctx.strokeStyle = 'rgba(100, 80, 60, 0.3)';
  ctx.lineWidth = ringThickness * 0.3;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRadiusInner, ringRadiusInner * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle bands
  ctx.fillStyle = 'rgba(150, 120, 80, 0.1)';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x - radius, y - radius * 0.3 + i * radius * 0.2, radius * 2, radius * 0.1);
  }
}

/**
 * Draw Earth with simple continents
 */
function drawEarth(x, y, radius) {
  const ctx = state.ctx;

  // Subtle green continents (very faint)
  ctx.fillStyle = 'rgba(100, 150, 80, 0.2)';

  // North America
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.3, y - radius * 0.2, radius * 0.25, radius * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eurasia
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.15, y - radius * 0.25, radius * 0.4, radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Africa
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.1, y + radius * 0.1, radius * 0.2, radius * 0.3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Cloud bands (very subtle)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.95, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw Mars with polar caps
 */
function drawMars(x, y, radius) {
  const ctx = state.ctx;

  // Polar ice caps (white at poles)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

  // North pole
  ctx.beginPath();
  ctx.ellipse(x, y - radius * 0.85, radius * 0.4, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // South pole
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.85, radius * 0.4, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Slight surface variation
  ctx.fillStyle = 'rgba(200, 100, 50, 0.15)';
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.2, y + radius * 0.1, radius * 0.5, radius * 0.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw Venus with atmospheric glow
 */
function drawVenus(x, y, radius) {
  const ctx = state.ctx;

  // Atmospheric glow
  const glowGrad = ctx.createRadialGradient(x, y, radius, x, y, radius * 1.3);
  glowGrad.addColorStop(0, 'rgba(255, 220, 100, 0.2)');
  glowGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Subtle cloud bands
  ctx.strokeStyle = 'rgba(255, 240, 200, 0.2)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + (i - 1) * radius * 0.3, radius * 0.95, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draw Uranus with subtle bands
 */
function drawUranus(x, y, radius) {
  const ctx = state.ctx;

  // Faint bands
  ctx.fillStyle = 'rgba(100, 200, 220, 0.15)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - radius, y - radius + i * radius * 0.5, radius * 2, radius * 0.25);
  }
}

/**
 * Draw Neptune with subtle bands
 */
function drawNeptune(x, y, radius) {
  const ctx = state.ctx;

  // Great Dark Spot (simplified)
  ctx.fillStyle = 'rgba(0, 50, 100, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.15, y + radius * 0.2, radius * 0.25, radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Faint bands
  ctx.fillStyle = 'rgba(100, 150, 200, 0.1)';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x - radius, y - radius + i * radius * 0.65, radius * 2, radius * 0.2);
  }
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
      case 'Escape':
        // Escape exits fullscreen if active, but also allow browser default
        if (state.isFullscreen) {
          document.exitFullscreen().then(() => {
            state.isFullscreen = false;
            showUI();
          }).catch(() => {}); // Ignore errors
        }
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
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen request failed:', err);
    }).then(() => {
      state.isFullscreen = true;
      hideUI();
      requestWakeLock();
    });
  } else {
    document.exitFullscreen().catch(err => {
      console.error('Exit fullscreen failed:', err);
    }).then(() => {
      state.isFullscreen = false;
      showUI();
    });
  }
}

// Handle fullscreen change events (e.g., Escape key)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    state.isFullscreen = false;
    showUI();
  } else {
    state.isFullscreen = true;
    hideUI();
  }
});

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
