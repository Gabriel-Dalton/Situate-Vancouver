# Commute beta — friends & family (~10 testers)

Plan for running a short **real-world commute test** of **Situate Vancouver** with a small trusted cohort. This version is tailored to the **actual product flows** in the repo (Vite + React map workspace at `/app.html`, optional marketing landing at `/`).

---

## What testers are actually using

- **Format**: **Web app in the mobile or desktop browser**, not an App Store install. They need a **stable URL** you control (e.g. staging or production). Local-only `localhost` is not workable for friends on their own devices.
- **Entry points**:
  - **Insight workspace**: `/app.html` — full map, layers, route finder, AI bar, status.
  - **Landing**: `/` — marketing page; browsers that have opened `/app.html` before may **skip straight to `/app.html`** on the next visit to `/` (see `frontend/public/situate-returning-user.js` / localStorage). Tell testers to bookmark **`/app.html`** if you want a consistent entry.
- **Backend dependency**: Map layers, route finding, and the AI query bar expect **Django + AI service** to be reachable from that URL (not “map tiles only”). If services are down, `StatusPanel` / errors should reflect that — call that out in “known issues” so feedback stays useful.

---

## Core flows to exercise (in order of commute relevance)

Use these as the **script** in your “start here” message to testers.

### 1. Orientation and health

- Open the insight app, pan/zoom the map, confirm **basemap and layers** load.
- Glance at **API / connectivity** messaging (e.g. status area) so they know whether the stack is healthy before blaming “the map.”

### 2. Mobility lens

- In the left rail, use **Mobility lens** to switch modes (e.g. **drive** vs **walk** vs **cycle**).
- **Drive** uses the traffic-style TomTom context described in the UI; other modes load **mode-specific overlays** (feature counts shown in the rail). Ask whether the **default lens** matches how they commute.

### 3. Layers that matter on a trip

- Toggle **insight layers** you care about for the test (e.g. **SkyTrain nodes**, **incident markers**, **buildings**, **BC Hydro outages** — whatever is enabled for your build).
- Ask: “Could you tell what was **on** vs **off** without hunting?”

### 4. Route finder (driving-oriented today)

- In **Route finder**, enter **From** and **To** (free text, same style as placeholders in the UI — landmarks or addresses).
- Confirm **multiple route options** appear when applicable, **distance/time**, and any note about **incidents near the route**.
- **On mobile only**, the panel exposes **Start navigation** / **Stop navigation** after a route is selected: this uses **browser geolocation** and shows the **navigation overlay** (step instruction, “then”, remaining distance). Commute testers on **transit or walking** should still try **route + map readability** even if they do not rely on turn-by-turn driving directions.

### 5. AI query bar

- From the header, submit a **natural-language question** (examples in the product rotate, e.g. construction, corridor busyness, closures, Canada Line).
- Confirm the **split view** opens with **analysis** and the map can **focus** on coordinates when the response is valid.
- Ask testers to note **slow failures**, **wrong location focus**, or **unhelpful** answers — especially on a **phone** with spotty connectivity.

### 6. Optional: sign-in

- If **`VITE_ENABLE_AUTH_UI`** is on for your deployment, a **Sign in / sign up** path appears in the header. Only include this in the script if it is enabled and you want coverage; otherwise skip to avoid confusion.

---

## Suggested tasks per tester

| Task | What you’re learning |
|------|----------------------|
| **A — “Real commute”** | Lens + layers + map usability on **their** actual trip (transit, walk, bike, or drive). |
| **B — “Plan a drive”** | Route finder end-to-end; on **mobile**, **Start navigation** for part of the trip **only if safe** (passenger or parked). Never require driving while handling the phone. |
| **C — “Ask the city”** | At least **two** AI queries: one **broad**, one **very specific** to a place they know. |

**Volume**: e.g. **3–5 sessions** over **1–2 weeks**, not daily homework.

---

## Recruitment and device mix

- **Target ~10 active testers**; invite **12–15** if you want slack for drop-off.
- Aim for mix: **iOS Safari**, **Android Chrome**, at least a few **desktop** sessions; **transit vs walk vs drive** so lens and layer toggles get real feedback.

---

## What you send testers (copy-ready checklist)

1. **URL**: exact link to **`/app.html`** (and landing `/` only if you want them to see marketing).
2. **Permissions**: **Location** when they tap **Start navigation** (mobile); explain it’s for the beta, not background tracking in a native sense.
3. **Known issues**: bullets (e.g. AI timeouts, incident data lag, walk/bike routing vs drive).
4. **Safety**: use navigation only when it is **legal and safe**; pulling over or passenger use only.
5. **How to report**: one channel + short template (below).

---

## Feedback template

**Quick (optional, after a trip — ~30 seconds)**  
- Worked / partly / broken — one line — **phone + browser**.

**End of beta (~5–10 minutes)**  
- Which tasks (A/B/C) did you do?  
- **Mobility lens**: did the right mode feel obvious?  
- **Route finder**: understandable results? Incident note useful?  
- **Navigation (mobile)**: overlay readable? Steps advance sensibly? Geolocation pain?  
- **AI bar**: queries that **worked** vs **failed**? Split view OK on small screens?  
- **Layers**: anything missing for your commute?  
- Crashes, blank map, or “API unreachable” — **when** and **what** you were doing.

---

## Timeline (example)

| Phase | Duration | Focus |
|-------|----------|--------|
| Setup | 2–3 days | Stable deploy, URL, known-issues list, invite message |
| Testing | 1–2 weeks | Async feedback; optional screenshot or voice memo on bugs |
| Synthesis | 2–3 days | Theme buckets: reliability, mobile UX, route/AI quality, lens/layers |

---

## Privacy and expectations (even for friends)

- One short note: **pre-release** product, **who on the team reads feedback**, whether **queries or routes** are logged server-side for debugging, and that they should **not** paste secrets into the AI bar.

---

## After the beta

- Triage into **must-fix** (repeat crashes, dead API, unusable mobile layout), **navigation/geolocation**, **route quality**, **AI quality**, and **layer/lens** gaps.  
- Update screenshots or onboarding copy if testers consistently misunderstand **drive-focused route finding** vs **transit-first** commutes.
