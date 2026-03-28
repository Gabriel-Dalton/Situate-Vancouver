# Screenshots and visuals

PNG assets in this folder are referenced from the [root README](../../README.md).

## Current assets (development / pre-deployment)

The checked-in **`insight-canvas.png`** and **`landing.png`** reflect the UI during active development. They may show **offline or degraded status** (for example, app health indicators when Django or the AI service is not running). That is expected for early README visuals.

## Planned refresh after deployment

After the site is **deployed** with production (or staging) backends and stable URLs:

1. Replace **`insight-canvas.png`** with a capture that shows the insight workspace with **healthy connectivity** (status panel green / no offline banner), when applicable.
2. Optionally add **`ai-query-split.png`**: natural-language query submitted, **Analyse** completed, split view with map focus and analysis content.
3. Replace **`landing.png`** if the marketing page changes materially post-launch.

Keep filenames stable so the README links do not break—overwrite the files in place.

**Tips:** 1600×900 or 1920×1080, dark UI, hide personal browser chrome. **`insight-canvas-illustration.svg`** remains an optional illustrative fallback and is not required for the README once PNGs are maintained.

## File checklist

| File | Purpose |
|------|---------|
| `insight-canvas.png` | Full insight app (`/app.html`): map, header, rails, tools. |
| `landing.png` | Marketing landing (`/`). |
| `ai-query-split.png` | *(Optional, post-deploy)* AI analysis + split layout. |

**For automation / contributors:** When deployment is ready, capture new shots, overwrite these files, and keep the README “Screenshots” note in sync if the disclaimer changes.
