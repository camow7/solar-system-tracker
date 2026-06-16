# Solar System — Ceiling Projection

A live, top-down heliocentric map of the solar system, designed to be projected full-screen onto a ceiling.

## Quick Start

```bash
cd ~/solar-system
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Controls

- **F** — Toggle fullscreen (projection mode)
- **+/−** — Increase/decrease time rate
- **Space** — Pause/resume
- **N** — Snap to now (current date/time)

## Features

- Heliocentric, top-down view (Sun at centre)
- 8 planets with logarithmically-scaled orbital rings
- Starry background
- Smooth animation with adjustable time rate
- Wake-lock support during projection (prevents display sleep)
- Auto-hides mouse cursor during inactivity

## Architecture

### Phase 1 (Complete)
- Static canvas layout with responsive sizing
- Starry background generation
- Sun rendering with subtle glow
- Orbital rings (log-scaled for legibility)

### Phase 2 (Next)
- Real planet positions from `astronomy-engine`
- Visual planet rendering (colours, sizes)

### Phase 3
- Smooth animation loop with time rate control
- Keyboard input handling

### Phase 4
- Polish: improved visuals, orbit trails

### Phase 5
- Fullscreen API integration
- Wake-lock, cursor hiding, projection mode

## Technology

- **Vanilla JS** + HTML5 Canvas 2D
- **astronomy-engine** (vendored locally) for accurate heliocentric positions
- No build step, no dependencies beyond astronomy-engine
- Static site, no backend

## Development Notes

- Orbital radius scale is **logarithmic** to fit all planets (Mercury 0.39 AU to Neptune 30 AU) in one frame
- Time rate default is **1 simulated day per real second** (adjustable with +/−)
- The coordinate system is **heliocentric ecliptic**, converted to top-down 2D polar: angle = longitude, radius = AU distance (scaled)
