# Manufacturing Execution System (MES) — Timeline Dashboard

A high-performance Industrial MES Timeline Dashboard built with **React 18, TypeScript, Vite, and Material UI (MUI v6)**.

---

## Quick Start

### 1. Prerequisites
- **Node.js** (v18 or v20+ recommended, tested on Node v24)
- **npm** (v9+ or v11+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
The application connects to the live backend by default. To customize the backend base URL, create or edit `.env`:

```env
VITE_API_BASE_URL=https://fractaldmsdev.centralindia.cloudapp.azure.com
```

### 4. Run Development Server
```bash
npm run dev
```
Open your browser at [http://localhost:3000](http://localhost:3000).

### 5. Test Credentials
- **Username**: `analytics_user`
- **Password**: `dashboard123`
- **Available Data Range**: 22–25 June 2026 (Defaults to `2026-06-23`).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local development server at `http://localhost:3000` |
| `npm run build` | Validates TypeScript types and generates production build in `dist/` |
| `npm run test` | Runs unit tests via Vitest |
| `npm run preview` | Previews the production build locally |

---

## Architectural Highlights

- **High-Performance Canvas 2D Charting**:
  Renders up to 20,000 individual produce markers at a sustained 60 FPS using HTML5 Canvas. Strictly adheres to **100% defect preservation (zero dropped FAIL markers)**.
- **Interactive Zoom & Inspection**:
  Brush drag to zoom into any time sub-range (with a 60-second minimum span). Double-click to reset.
- **O(log N) Binary Search Hover Tooltips**:
  Sub-millisecond hover identification for both produce items and segment interval bands.
- **IST ↔ UTC Timezone Engine**:
  Translates IST shift windows to UTC ISO strings for backend requests, and converts all received UTC timestamps back to IST for display.
- **Hourly Production & Downtime Summary Table**:
  Continuous tiled segments are sliced cleanly at hour boundaries and aggregated into runtime, downtime, stoppage, produce counts, and cycle-time metrics.
- **Authentication & Session Lifecycle**:
  JWT token management, session recovery on load (`GET /auth/me`), reactive 401 handling, protected routes, and logout.

For deep-dive technical explanations and design justifications, see [`NOTES.md`](./NOTES.md).
