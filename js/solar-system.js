/**
 * Solar System Ceiling Projection
 * Heliocentric, top-down view with real planet positions
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Planet definitions with visual properties and orbital eccentricity
  planets: [
    { name: 'Mercury', body: 'Mercury', radius: 3, color: '#8C7853', eccentricity: 0.206 },
    { name: 'Venus', body: 'Venus', radius: 6, color: '#FFC649', eccentricity: 0.007 },
    { name: 'Earth', body: 'Earth', radius: 6.5, color: '#4A90E2', eccentricity: 0.017 },
    { name: 'Mars', body: 'Mars', radius: 4, color: '#E27B58', eccentricity: 0.093 },
    { name: 'Jupiter', body: 'Jupiter', radius: 14, color: '#C88B3A', eccentricity: 0.048 },
    { name: 'Saturn', body: 'Saturn', radius: 12, color: '#E5C55B', eccentricity: 0.056 },
    { name: 'Uranus', body: 'Uranus', radius: 8, color: '#4FD0E7', eccentricity: 0.047 },
    { name: 'Neptune', body: 'Neptune', radius: 8, color: '#4166F5', eccentricity: 0.009 },
  ],

  // Moons of planets (body name, parent planet index, actual AU orbit distance)
  moons: [
    // Jupiter's Galilean moons
    { name: 'Io', body: 'Io', parent: 'Jupiter', parentIndex: 4, color: '#FFD700', radius: 1.2 },
    { name: 'Europa', body: 'Europa', parent: 'Jupiter', parentIndex: 4, color: '#E8E8E8', radius: 1.2 },
    { name: 'Ganymede', body: 'Ganymede', parent: 'Jupiter', parentIndex: 4, color: '#A9A9A9', radius: 1.4 },
    { name: 'Callisto', body: 'Callisto', parent: 'Jupiter', parentIndex: 4, color: '#696969', radius: 1.3 },
    // Saturn's moons
    { name: 'Titan', body: 'Titan', parent: 'Saturn', parentIndex: 5, color: '#FFA500', radius: 1.5 },
    { name: 'Enceladus', body: 'Enceladus', parent: 'Saturn', parentIndex: 5, color: '#F0F8FF', radius: 0.8 },
    { name: 'Rhea', body: 'Rhea', parent: 'Saturn', parentIndex: 5, color: '#D3D3D3', radius: 1.0 },
    // Neptune's moon
    { name: 'Triton', body: 'Triton', parent: 'Neptune', parentIndex: 7, color: '#87CEEB', radius: 1.1 },
  ],

  // Major asteroids in the asteroid belt (rough AU positions)
  asteroids: [
    { name: 'Ceres', au: 2.77, eccentricity: 0.076, color: '#808080' },
    { name: 'Vesta', au: 2.36, eccentricity: 0.089, color: '#A0522D' },
    { name: 'Pallas', au: 2.77, eccentricity: 0.231, color: '#696969' },
    { name: 'Juno', au: 2.67, eccentricity: 0.256, color: '#8B4513' },
  ],

  // Known spacecraft (approximate positions, actual positions would need live data)
  spacecraft: [
    { name: 'JWST', au: 0.01, angle: 0.5, color: '#FFD700', symbol: '⭐' }, // Near Earth-Sun L2
    { name: 'Parker Solar Probe', au: 0.1, angle: 1.2, color: '#FF6347', symbol: '🚀' },
    { name: 'Voyager 1', au: 50, angle: 0.8, color: '#90EE90', symbol: '→' }, // Far out
  ],

  // Visual scale: log-compressed radius for legibility
  // Lower value = more spread out; higher = more compressed
  // 1.5 = tight inner planets; 1.3 = better spacing
  logBase: 1.3,

  // Eccentricity exaggeration factor for visual clarity
  // Real eccentricities are very small; multiply by this to make them visible
  eccentricityScale: 3.0,

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

  // Display options
  showLabels: false,

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
  setupTouchControls();
  setupHelpModal();

  // Start animation loop
  requestAnimationFrame(animate);
}

function setupHelpModal() {
  const helpButton = document.getElementById('helpButton');
  const labelsButton = document.getElementById('labelsButton');
  const closeButton = document.getElementById('closeModal');
  const modal = document.getElementById('modal');

  helpButton.addEventListener('click', toggleHelpModal);
  labelsButton.addEventListener('click', toggleLabelsAndUpdateButton);
  closeButton.addEventListener('click', closeHelpModal);

  // Close modal when clicking outside the content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeHelpModal();
    }
  });

  // Update labels button state on first load
  updateLabelsButtonState();
}

function toggleLabelsAndUpdateButton() {
  state.showLabels = !state.showLabels;
  updateLabelsButtonState();
}

function updateLabelsButtonState() {
  const labelsButton = document.getElementById('labelsButton');
  if (state.showLabels) {
    labelsButton.classList.add('active');
  } else {
    labelsButton.classList.remove('active');
  }
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
 * Convert AU distance to canvas pixels using even spacing
 * All planets are equally spaced regardless of actual AU distance
 */
function auToPixels(au, planetIndex = null) {
  if (au === 0) return 0;

  // If planet index provided, use it directly for even spacing
  if (planetIndex !== null) {
    const numPlanets = CONFIG.planets.length;
    const maxPixelRadius = Math.min(state.width, state.height) * 0.42;
    const spacingPerPlanet = maxPixelRadius / (numPlanets + 1);
    return spacingPerPlanet * (planetIndex + 1);
  }

  // Fallback: estimate index from AU (for older code paths)
  const auValues = [0.39, 0.72, 1.0, 1.52, 5.2, 9.54, 19.19, 30.07];
  let closestIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < auValues.length; i++) {
    const diff = Math.abs(auValues[i] - au);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  return auToPixels(au, closestIndex);
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

  CONFIG.planets.forEach((planet, index) => {
    const semiMajor = auToPixels(planet.au, index);

    // Calculate semi-minor axis from exaggerated eccentricity for visibility
    // b = a * sqrt(1 - (e * scale)²), clamped to prevent negative values
    const e = (planet.eccentricity || 0) * CONFIG.eccentricityScale;
    const eClamped = Math.min(e, 0.99); // Prevent b from being 0 or negative
    const semiMinor = semiMajor * Math.sqrt(1 - eClamped * eClamped);

    // Get current planet position to rotate ellipse to align with actual orbit
    const pos = getPlanetPosition(planet.body, state.currentDate);
    const rotationAngle = pos ? pos.angle : 0;

    // Draw ellipse
    drawEllipse(state.centerX, state.centerY, semiMajor, semiMinor, rotationAngle);
  });
}

/**
 * Draw an ellipse with rotation support
 */
function drawEllipse(centerX, centerY, radiusX, radiusY, rotation) {
  state.ctx.save();
  state.ctx.translate(centerX, centerY);
  state.ctx.rotate(rotation);
  state.ctx.beginPath();
  state.ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  state.ctx.restore();
  state.ctx.stroke();
}

function drawPlanets(date) {
  CONFIG.planets.forEach((planet, index) => {
    const pos = getPlanetPosition(planet.body, date);
    if (!pos) return;

    // Use evenly spaced pixels based on planet index
    const pixelRadius = auToPixels(pos.au, index);
    const x = state.centerX + pixelRadius * Math.cos(pos.angle);
    const y = state.centerY + pixelRadius * Math.sin(pos.angle);

    // Add to trail (sample every few frames to reduce density)
    if (Math.random() < 0.2) { // 20% of frames add to trail
      addTrailPoint(planet.body, x, y);
    }

    // Draw planet with enhanced details
    drawPlanetDetailed(planet, x, y, planet.radius);

    // Draw Moon around Earth
    if (planet.body === 'Earth') {
      drawMoonAroundEarth(date, x, y);
    }
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
 * Draw Earth with visible continents
 */
function drawEarth(x, y, radius) {
  const ctx = state.ctx;

  // Green continents (much more visible)
  ctx.fillStyle = 'rgba(80, 140, 60, 0.5)';

  // North America
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.35, y - radius * 0.15, radius * 0.3, radius * 0.4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // South America
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.25, y + radius * 0.35, radius * 0.15, radius * 0.25, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eurasia
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.15, y - radius * 0.3, radius * 0.45, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Africa
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.1, y + radius * 0.15, radius * 0.25, radius * 0.35, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Australia
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.35, y + radius * 0.25, radius * 0.15, radius * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloud bands (subtle white overlay)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y + (i - 1) * radius * 0.35, radius * 1.0, radius * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
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

/**
 * Draw the Moon orbiting Earth
 * Moon's actual distance is ~0.00257 AU; exaggerate for visibility
 */
function drawMoonAroundEarth(date, earthX, earthY) {
  try {
    if (typeof Astronomy === 'undefined') return;

    // Get Moon's heliocentric position
    const moonHelio = Astronomy.HelioVector('Moon', date);
    const earthHelio = Astronomy.HelioVector('Earth', date);

    // Calculate Moon's position relative to Earth
    const moonRelX = moonHelio.x - earthHelio.x;
    const moonRelY = moonHelio.y - earthHelio.y;
    const moonDistance = Math.sqrt(moonRelX * moonRelX + moonRelY * moonRelY); // AU

    // Moon's actual distance is ~0.00257 AU
    // Use a fixed visual distance that scales with Earth's planet radius
    // This keeps the Moon orbit proportional to Earth's visual size
    const earthRadius = 6.5; // From CONFIG.planets[Earth].radius
    const pixelDistance = earthRadius * 2; // Moon orbits at ~2x Earth's visual radius

    // Calculate Moon's position relative to Earth
    const moonAngle = Math.atan2(moonRelY, moonRelX);
    const moonX = earthX + pixelDistance * Math.cos(moonAngle);
    const moonY = earthY + pixelDistance * Math.sin(moonAngle);

    // Draw Moon's orbital path (thin circle around Earth)
    state.ctx.strokeStyle = 'rgba(200, 200, 200, 0.1)';
    state.ctx.lineWidth = 0.5;
    state.ctx.beginPath();
    state.ctx.arc(earthX, earthY, pixelDistance, 0, Math.PI * 2);
    state.ctx.stroke();

    // Draw Moon (small gray sphere)
    const moonRadius = 2.5; // Visual size on screen
    const moonGradient = state.ctx.createRadialGradient(moonX - moonRadius * 0.3, moonY - moonRadius * 0.3, 0, moonX, moonY, moonRadius);
    moonGradient.addColorStop(0, 'rgba(200, 200, 200, 0.9)');
    moonGradient.addColorStop(1, 'rgba(120, 120, 120, 0.9)');

    state.ctx.fillStyle = moonGradient;
    state.ctx.beginPath();
    state.ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    state.ctx.fill();

    // Subtle outline
    state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    state.ctx.lineWidth = 0.3;
    state.ctx.stroke();
  } catch (err) {
    console.warn('Failed to render Moon:', err);
  }
}

/**
 * Draw all planetary moons (Jupiter, Saturn, Neptune moons)
 */
function drawMoons(date) {
  // Group moons by parent planet
  const moonsByParent = {};
  CONFIG.moons.forEach(moon => {
    if (!moonsByParent[moon.parent]) {
      moonsByParent[moon.parent] = [];
    }
    moonsByParent[moon.parent].push(moon);
  });

  // Get planet positions and draw their moons
  CONFIG.planets.forEach((planet, index) => {
    const planetPos = getPlanetPosition(planet.body, date);
    if (!planetPos || !moonsByParent[planet.body]) return;

    const pixelRadius = auToPixels(planetPos.au, index);
    const planetX = state.centerX + pixelRadius * Math.cos(planetPos.angle);
    const planetY = state.centerY + pixelRadius * Math.sin(planetPos.angle);

    // Draw each moon around its parent planet
    moonsByParent[planet.body].forEach((moon, moonIndex) => {
      try {
        const moonHelio = Astronomy.HelioVector(moon.body, date);
        const moonRelX = moonHelio.x - planetPos.x;
        const moonRelY = moonHelio.y - planetPos.y;

        // Scale moon distance (exaggerate for visibility)
        const moonOrbitDistance = Math.sqrt(moonRelX * moonRelX + moonRelY * moonRelY);
        const moonVisualDistance = planet.radius * (1.5 + moonIndex * 0.8); // Stack moons at different distances

        const moonAngle = Math.atan2(moonRelY, moonRelX);
        const moonX = planetX + moonVisualDistance * Math.cos(moonAngle);
        const moonY = planetY + moonVisualDistance * Math.sin(moonAngle);

        // Draw moon
        state.ctx.fillStyle = moon.color;
        state.ctx.beginPath();
        state.ctx.arc(moonX, moonY, moon.radius, 0, Math.PI * 2);
        state.ctx.fill();

        // Subtle outline
        state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        state.ctx.lineWidth = 0.3;
        state.ctx.stroke();
      } catch (err) {
        // Moon not available in this time period
      }
    });
  });
}

/**
 * Draw asteroid belt
 */
function drawAsteroids(date) {
  CONFIG.asteroids.forEach(asteroid => {
    try {
      // Asteroids don't have direct support in astronomy-engine,
      // so we'll approximate their position using heliocentric ellipse
      // Position them evenly spaced in the belt area
      const au = asteroid.au;
      const angle = (date.getTime() / 1000 / 365.25 / 86400 + asteroid.au) % (Math.PI * 2);

      const pixelRadius = state.centerX * 0.35; // Rough asteroid belt zone
      const asteroidIndex = CONFIG.asteroids.indexOf(asteroid);
      const spreadDistance = pixelRadius + asteroidIndex * 8;

      const x = state.centerX + spreadDistance * Math.cos(angle);
      const y = state.centerY + spreadDistance * Math.sin(angle);

      // Draw small asteroid
      state.ctx.fillStyle = asteroid.color;
      state.ctx.beginPath();
      state.ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      state.ctx.fill();
    } catch (err) {
      console.warn('Failed to render asteroid:', err);
    }
  });
}

/**
 * Draw spacecraft
 */
function drawSpacecraft(date) {
  CONFIG.spacecraft.forEach(craft => {
    try {
      // For now, use approximate fixed positions
      // In a real implementation, these would use actual mission data APIs
      const angle = (date.getTime() / 1000 / 365.25 / 86400 + craft.angle) % (Math.PI * 2);

      // Map AU distance to pixels
      let pixelDistance;
      if (craft.au < 1) {
        pixelDistance = auToPixels(craft.au, 2); // Near Earth
      } else if (craft.au < 35) {
        pixelDistance = auToPixels(craft.au, Math.floor(craft.au)); // Inner solar system
      } else {
        pixelDistance = state.centerX * 0.45; // Far out
      }

      const x = state.centerX + pixelDistance * Math.cos(angle);
      const y = state.centerY + pixelDistance * Math.sin(angle);

      // Draw spacecraft as small diamond
      const size = 2;
      state.ctx.fillStyle = craft.color;
      state.ctx.beginPath();
      state.ctx.moveTo(x + size, y);
      state.ctx.lineTo(x, y + size);
      state.ctx.lineTo(x - size, y);
      state.ctx.lineTo(x, y - size);
      state.ctx.closePath();
      state.ctx.fill();

      // Outline
      state.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      state.ctx.lineWidth = 0.5;
      state.ctx.stroke();
    } catch (err) {
      console.warn('Failed to render spacecraft:', err);
    }
  });
}

/**
 * Draw labels for all objects (planets, moons, asteroids, spacecraft)
 */
function drawLabels(date) {
  state.ctx.font = '12px monospace';
  state.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  state.ctx.textAlign = 'left';

  // Draw planet labels
  CONFIG.planets.forEach((planet, index) => {
    const pos = getPlanetPosition(planet.body, date);
    if (!pos) return;

    const pixelRadius = auToPixels(pos.au, index);
    const x = state.centerX + pixelRadius * Math.cos(pos.angle);
    const y = state.centerY + pixelRadius * Math.sin(pos.angle);

    drawLabel(planet.name, x + planet.radius + 5, y - planet.radius);
  });

  // Draw moon labels
  CONFIG.moons.forEach((moon) => {
    try {
      const planetPos = getPlanetPosition(moon.parent, date);
      if (!planetPos) return;

      const planetIndex = CONFIG.planets.findIndex(p => p.body === moon.parent);
      const pixelRadius = auToPixels(planetPos.au, planetIndex);
      const planetX = state.centerX + pixelRadius * Math.cos(planetPos.angle);
      const planetY = state.centerY + pixelRadius * Math.sin(planetPos.angle);

      const moonHelio = Astronomy.HelioVector(moon.body, date);
      const moonRelX = moonHelio.x - planetPos.x;
      const moonRelY = moonHelio.y - planetPos.y;
      const moonVisualDistance = CONFIG.planets[planetIndex].radius * (1.5 + CONFIG.moons.indexOf(moon) * 0.8);

      const moonAngle = Math.atan2(moonRelY, moonRelX);
      const moonX = planetX + moonVisualDistance * Math.cos(moonAngle);
      const moonY = planetY + moonVisualDistance * Math.sin(moonAngle);

      drawLabel(moon.name, moonX + 4, moonY - 8);
    } catch (err) {
      // Skip if moon data unavailable
    }
  });

  // Draw asteroid labels
  CONFIG.asteroids.forEach(asteroid => {
    const angle = (date.getTime() / 1000 / 365.25 / 86400 + asteroid.au) % (Math.PI * 2);
    const pixelRadius = state.centerX * 0.35 + CONFIG.asteroids.indexOf(asteroid) * 8;
    const x = state.centerX + pixelRadius * Math.cos(angle);
    const y = state.centerY + pixelRadius * Math.sin(angle);

    drawLabel(asteroid.name, x + 4, y - 8);
  });

  // Draw spacecraft labels
  CONFIG.spacecraft.forEach(craft => {
    const angle = (date.getTime() / 1000 / 365.25 / 86400 + craft.angle) % (Math.PI * 2);

    let pixelDistance;
    if (craft.au < 1) {
      pixelDistance = auToPixels(craft.au, 2);
    } else if (craft.au < 35) {
      pixelDistance = auToPixels(craft.au, Math.floor(craft.au));
    } else {
      pixelDistance = state.centerX * 0.45;
    }

    const x = state.centerX + pixelDistance * Math.cos(angle);
    const y = state.centerY + pixelDistance * Math.sin(angle);

    drawLabel(craft.name, x + 6, y - 8);
  });
}

/**
 * Draw a single label with background
 */
function drawLabel(text, x, y) {
  state.ctx.font = '11px monospace';
  const metrics = state.ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 12;

  // Semi-transparent background
  state.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  state.ctx.fillRect(x - 2, y - textHeight + 2, textWidth + 4, textHeight);

  // Text
  state.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  state.ctx.textAlign = 'left';
  state.ctx.fillText(text, x, y);
}

function frame() {
  // Clear canvas with dark background
  state.ctx.fillStyle = '#000';
  state.ctx.fillRect(0, 0, state.width, state.height);

  // Draw starfield
  drawStars();

  // Draw orbital rings
  drawOrbits();

  // Draw asteroid belt
  drawAsteroids(state.currentDate);

  // Draw orbit trails (before planets so they appear behind)
  drawTrails();

  // Draw Sun
  drawSun();

  // Draw planets
  drawPlanets(state.currentDate);

  // Draw moons around planets
  drawMoons(state.currentDate);

  // Draw spacecraft
  drawSpacecraft(state.currentDate);

  // Draw labels if enabled
  if (state.showLabels) {
    drawLabels(state.currentDate);
  }

  // Update info display
  updateInfoDisplay();
}

function updateInfoDisplay() {
  const dateEl = document.getElementById('dateDisplay');
  const rateEl = document.getElementById('timeRateDisplay');

  const dateStr = state.currentDate.toISOString().split('T')[0];
  dateEl.textContent = `Date: ${dateStr}`;

  const rateStr = state.isPaused ? 'PAUSED' : `${state.timeRate.toFixed(2)} d/s`;
  const labelStr = state.showLabels ? ' | Labels ON' : '';
  rateEl.textContent = `Rate: ${rateStr}${labelStr}`;
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

  // Update UI state
  updateLabelsButtonState();

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
      case '?':
        toggleHelpModal();
        e.preventDefault();
        break;
      case 'l':
      case 'L':
        state.showLabels = !state.showLabels;
        e.preventDefault();
        break;
      case 'Escape':
        // Close modal if open
        const modal = document.getElementById('modal');
        if (modal.classList.contains('show')) {
          closeHelpModal();
        }
        // Escape exits fullscreen if active
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

function toggleHelpModal() {
  const modal = document.getElementById('modal');
  modal.classList.toggle('show');
}

function closeHelpModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
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
// TOUCH CONTROLS (Mobile)
// ============================================================================

function setupTouchControls() {
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Detect double-tap for "snap to now"
    const now = Date.now();
    const tapX = touch.clientX;
    const tapY = touch.clientY;
    const tapDistance = Math.sqrt(Math.pow(tapX - lastTapX, 2) + Math.pow(tapY - lastTapY, 2));

    if (now - lastTapTime < 300 && tapDistance < 50) {
      // Double-tap detected
      state.currentDate = new Date();
      state.isPaused = false;
      lastTapTime = 0; // Reset
    } else {
      lastTapTime = now;
      lastTapX = tapX;
      lastTapY = tapY;
    }
  });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Require at least 30px movement to register as swipe
    if (distance > 30) {
      // Horizontal swipe: adjust time rate
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right: increase time rate
          state.timeRate *= 1.15;
        } else {
          // Swipe left: decrease time rate
          state.timeRate = Math.max(0.001, state.timeRate / 1.15);
        }
      }
      // Vertical swipe: pause/resume
      else if (Math.abs(deltaY) > Math.abs(deltaX)) {
        state.isPaused = !state.isPaused;
      }
    }
    // Single tap (small movement): pause/resume
    else if (distance < 15 && Date.now() - lastTapTime > 300) {
      state.isPaused = !state.isPaused;
    }
  });

  // Prevent default touch behaviors (zoom, scroll)
  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
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
