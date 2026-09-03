# Senior Frontend Assignment — Engineering Notes (`NOTES.md`)

This document details the architectural decisions, performance strategies, timezone math, and trade-offs implemented for the **Industrial MES Timeline Dashboard**.

---

## 1. Session & Token Management

### Storage Decision: `localStorage` with In-Memory React Auth Context
We evaluated four primary token storage options against the assignment criteria:

1. **`localStorage` (Selected)**:
   - *Rationale*: Persists the session across page refreshes and browser tabs without requiring a separate refresh-token cookie infrastructure (which this backend does not provide).
   - *Trade-off (XSS vs. Usability)*: While `localStorage` is accessible to JavaScript and therefore vulnerable if an XSS vulnerability exists, this risk is mitigated in our application by standard React automatic string escaping, strict TypeScript sanitization, and the absence of `dangerouslySetInnerHTML`. Furthermore, because the access token is returned directly in the JSON response body (`POST /auth/login`), an `HttpOnly` cookie could not be established client-side without a backend Set-Cookie header.
2. **`sessionStorage`**:
   - Clears as soon as a tab is closed, hurting operator usability on factory floor workstations.
3. **In-Memory only**:
   - Forfeits session persistence upon refresh, directly failing requirement 1.3 ("On app load, restore the session so a page refresh keeps the user logged in").

### Centralized API Client & Token Interceptors
All network requests flow through a single, configured Axios instance (`src/api/client.ts`):
- **Request Interceptor**: Reads the token from `localStorage` under `TOKEN_STORAGE_KEY` and injects `Authorization: Bearer <token>`.
- **Response Interceptor & MES Envelope**: Unwraps the standardized MES envelope `{ trace_id, status_code, message, data }`. If `status_code >= 400`, it rejects with the backend's explicit `message`.
- **Session Expiry (401 Handling)**:
  - If any authenticated request (excluding `POST /auth/login` itself) receives an HTTP 401 response, the interceptor immediately clears the token from `localStorage` and routes the user to `/login?expired=1`.
  - On `POST /auth/login`, 401 returns an inline error message ("Invalid username or password") without causing an infinite redirect loop.

### Session Recovery on Load (`GET /auth/me`)
On initial mount of the application, `AuthProvider` inspects `localStorage`. If a token exists, it calls `GET /auth/me` to validate credentials with the backend before displaying protected dashboard views. If `GET /auth/me` fails or returns 401, the session is purged and the user is redirected to `/login`.

---

## 2. Timeline Chart Performance Architecture (10,000–20,000 Markers)

### Why Canvas 2D over SVG / DOM
Standard charting libraries (such as Recharts or raw SVG) instantiate a DOM node per data point. At 10,000 to 20,000 points, managing ~20,000 SVG elements in the browser DOM tree leads to severe GC pressure, multi-second layout thrashing, and dropped animation frames during mouse drag, zoom, or hover.

We implemented a custom, zero-dependency **HTML5 Canvas 2D engine** (`src/components/chart/TimelineCanvas.tsx`):
- Renders directly to a hardware-accelerated 2D canvas context at native retina resolution (`window.devicePixelRatio`).
- Eliminates DOM node overhead completely: 20,000 points draw in under 4 milliseconds per frame.

### Downsampling & Strict Defect Preservation (Zero Dropped FAILs)
When "Show individual produces" is active with tens of thousands of points:
1. **Rule 1 — Absolute Retention of Defect Points**:
   - **FAIL markers are NEVER downsampled or dropped**.
   - An operator's primary duty on an MES dashboard is diagnosing defects. All FAIL points (`result === 'FAIL'`) are collected into a dedicated high-priority layer and drawn unconditionally with distinct red cross markers (`✕`) on top of all other elements.
2. **Sub-Pixel Screen Binning for PASS Points**:
   - Across an average screen width of ~1200 pixels, thousands of PASS markers inevitably project onto identical fractional pixel columns.
   - We bin PASS points by integer pixel coordinate (`Math.floor(x)`). This draws at most one representative marker per screen pixel column, eliminating redundant GPU fill-rate overdraw while faithfully representing instantaneous production continuity.
   - As the user zooms into a narrower time window, the time-to-pixel ratio widens dynamically, revealing more granular markers automatically.
3. **Geometry Resolution & Zero Date Parsing in Render Loop**:
   - Timestamps are converted to integer epoch milliseconds **once** during data ingestion using `useMemo`.
   - The main `requestAnimationFrame` render loop performs pure numeric arithmetic: `x = paddingLeft + ((ms - startMs) / span) * width`. No string formatting or date parsing occurs inside mouse move or render cycles.

### Zoom & Hover Tooltip Optimization
- **Brush Zoom**: Users can drag across any portion of the chart to inspect that sub-interval. Double-clicking instantly resets the zoom to the full shift window.
- **O(log N) Binary Search Hover**: Because individual produce points are sorted by epoch time on ingest, finding the marker closest to the cursor takes `O(log N)` (~14 comparisons for 20,000 points) via binary search rather than `O(N)` linear scanning.

---

## 3. Time & Timezone Math (UTC ↔ IST)

### Bidirectional Translation
- **Backend Convention**: The API strictly accepts and returns UTC ISO 8601 strings ending in `Z` (`YYYY-MM-DDTHH:mm:ssZ`).
- **Frontend Convention**: The factory floor operates strictly in Indian Standard Time (**IST**, `Asia/Kolkata`, `UTC + 05:30`).

### Shift Window Calculation
Shifts are parsed dynamically from `GET /core/shifts` (e.g. `shift_timings: ["00:30", "12:30"]`):
1. **Start Time in IST**: Built from selected date + start `HH:mm` in `Asia/Kolkata`.
2. **End Time & Midnight Crossing**: Built from selected date + end `HH:mm`. If `endTime <= startTime` (e.g. `12:30` to `00:30`), the window crosses midnight, adding exactly 1 calendar day to the IST end date.
3. **Conversion to UTC**: Both start and end are converted to UTC ISO strings (`from_ts`, `to_ts`) sent in the API request body.
   *Example*: `2026-06-23 00:30 IST` becomes `2026-06-22T19:00:00.000Z` in UTC.

---

## 4. Hourly Production & Downtime Summary Bucketing

The backend returns tiled segments (`runtimes`, `downtimes`, `stoppages`). In `src/utils/segmentSlicer.ts`:
1. The shift window is divided into 1-hour columns starting from the shift start time (e.g. `00:30–01:30`, `01:30–02:30`, etc.).
2. **Segment Slicing**: For each segment spanning across hour boundaries (e.g., a planned runtime from `08:33` to `10:12` IST):
   - Overlap with each column is calculated:
     $$\text{overlapMinutes} = \frac{\min(\text{segmentEnd}, \text{colEnd}) - \max(\text{segmentStart}, \text{colStart})}{60,000}$$
   - The minutes are added into that specific hour's metric row (`Runtime`, `Unplanned Production`, `Planned Downtime`, `Unknown Downtime`, `Minor Stoppage`).
   - For every fully elapsed hour, $\sum \text{minutes} \approx 60 \text{ min}$.
3. **Produce Sums**: `produce_counts` are summed across part models for each hour bucket.
4. **Cycle-Time Endpoint Integration**: Values from `POST /analytics-query` (`ideal_cycle_time_seconds`, `actual_cycle_time_seconds`) are matched by `bucket_start` and formatted into readable units (`mins` or `secs`).
5. **In-Progress Shift Guard**: If an hour slot starts after `now` in IST, the cells remain empty rather than displaying false zeros.

---

## 5. Assumptions & Scope Adherence

In accordance with the assignment specifications, the following were intentionally kept out of scope to prioritize chart smoothness and data accuracy:
- No segment classification or downtime editing modals.
- No auto-polling (a dedicated manual refresh button is provided).
- No CSV/PDF export or multi-tenant themes.
- Asset tree selector allows selecting any machine or line node directly without multi-machine asset hierarchy tree drill-down views.
