# Solar System — Ceiling Projection

A live, top-down heliocentric map of the solar system, designed to be projected full-screen onto a ceiling. Real planet positions calculated from the `astronomy-engine` library, with smooth animation and intuitive controls.

## Quick Start

**Setup (one-time):**
```bash
cd ~/solar-system
npm install  # Installs astronomy-engine; vendored to lib/ for offline use
```

**Run:**
```bash
cd ~/solar-system
python3 -m http.server 8000  # Or use any static server
```

Then open `http://localhost:8000` in a browser.

## Controls

### Desktop — Keyboard
- **+** / **−** — Increase/decrease simulation speed (default: 1 day/sec)
- **Space** — Pause/resume animation
- **N** — Snap to current date/time and resume
- **F** — Toggle fullscreen (projection mode)
- **Escape** — Exit fullscreen

### Mobile — Touch Gestures
- **Swipe Right** — Speed up simulation
- **Swipe Left** — Slow down simulation
- **Swipe Up/Down** — Pause/resume
- **Tap** — Pause/resume
- **Double-tap** — Snap to current date/time

### Projection Mode (Desktop)
- Press **F** to enter fullscreen:
  - UI automatically hidden
  - Screen wake-lock active (prevents display sleep)
  - Mouse cursor auto-hides after 3 seconds of inactivity
  - Press **F** or **Escape** to exit

## Features

- **Heliocentric Top-Down View** — Sun at centre, planets orbiting in 2D
- **Real Planet Positions** — Calculated from `astronomy-engine` for any date
- **Logarithmic Orbital Scaling** — All planets (Mercury 0.39 AU to Neptune 30 AU) visible in one frame
- **Orbit Trails** — Faint trails show recent planetary motion
- **Photorealistic Colours** — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **Starry Background** — Fixed, deterministic starfield
- **Responsive Layout** — Works at any viewport size
- **Offline-First** — Vendored `astronomy-engine`, no CDN or API calls
- **Wake-Lock Support** — Display stays on during projection (when supported)
- **Smooth Animation** — 60fps via `requestAnimationFrame`

## Setup for Ceiling Projection

1. **Connect a projector** to your display
2. **Load the page** in a web browser
3. **Press F** to enter fullscreen projection mode
4. **Adjust time rate** with +/− as needed:
   - 0.1–0.5 days/sec: Slow, contemplative motion
   - 1 day/sec: Default, good for watching planetary motion
   - 5–10 days/sec: Faster motion, see monthly changes
   - 100+ days/sec: See full orbital cycles
5. **Leave running** — Cursor hides, display stays on (wake-lock active)

## Technical Details

### Architecture
- **Phase 1** — Static canvas layout with orbital rings and starry background
- **Phase 2** — Real planet positions from `astronomy-engine`
- **Phase 3** — Smooth animation with time-rate control and keyboard input
- **Phase 4** — Visual polish: colours, sizes, Sun glow, orbit trails
- **Phase 5** — Projection mode: fullscreen API, wake-lock, cursor hiding

### Technology Stack
- **Vanilla JavaScript** + HTML5 Canvas 2D (no frameworks)
- **astronomy-engine** (vendored locally) for heliocentric ecliptic positions
- Static site, no backend or build step
- Runs fully offline

### Position Calculation
1. For each planet at a given date:
   - `astronomy-engine` returns heliocentric position in AU (x, y, z)
   - Z-component (out-of-plane) ignored for top-down view
   - Heliocentric ecliptic longitude → angle, distance → radius
2. **Logarithmic scaling** compresses the huge AU range into legible pixel distances
3. Convert polar to Cartesian coordinates for canvas rendering

### Performance Notes
- Planets positioned fresh every frame (no pre-computed ephemeris)
- Orbit trails sampled at 20% of frames to reduce memory
- Single canvas for rendering (no compositing overhead)
- Starfield regenerated on resize (slight perf trade-off for coverage)

## Customization

### Change Time Rate Scale
Edit `CONFIG.logBase` in `js/solar-system.js` (default: 1.5)
- Lower = more compressed spacing between orbits
- Higher = more spread out

### Adjust Planet Sizes
Edit `CONFIG.planets[].radius` in `js/solar-system.js`
- Sizes are arbitrary visual units, not to scale

### Modify Orbital Ring Appearance
Edit the `drawOrbits()` function to change colour, opacity, or remove rings entirely

## Validation & Testing

The planet positions are calculated using the `astronomy-engine` library, which is well-tested against NASA JPL HORIZONS data. A manual sanity check can be done at [NASA HORIZONS](https://ssd.jpl.nasa.gov/api/horizons.api) for any date.

## Known Limitations

- Times are always interpreted as UTC (no timezone handling)
- No labels in projection mode (by design—minimal visual clutter)
- No moons or asteroids
- Orbit trails only show recent history (not full orbital history)
- Wake-lock is not supported in all browsers (degrades gracefully)

## Future Enhancements

- Option to show constellation background
- Historical date selection dialog
- Record/playback of animations
- Export as video
- Integration with orrery databases for comets/asteroids
