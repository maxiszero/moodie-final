# Moodie emotion palette

Canonical hex triples (`color`, `color2`, `color3`) are defined in:

| Location | File |
|----------|------|
| Node API (posts/users enforcement) | `backend/src/config/emotionPalette.ts` |
| Python API / workers | `backend-py/app/services/palette.py` |
| Mood analysis service | `python-service/main.py` (fallback rules only; palette should match Node) |
| Frontend cards / post gradients | `frontend/src/config/emotionPalette.ts` |

Aliases (e.g. `calm` → `calmness`, `inspired` → `inspiration`) live next to the palette in the Node config.

## When changing colors

1. Update `backend/src/config/emotionPalette.ts` first.
2. Mirror the same keys in `backend-py/app/services/palette.py` and any literal fallbacks in `aiAnalyzer`, `ai.py`, and `python-service/main.py`.
3. Update `frontend/src/config/emotionPalette.ts` (`ONBOARDING_EMOTION_CARDS`) and, if needed, `legacy.css` `--emotion-*` variables.
4. Optional: run the one-shot DB migration so old documents get new triples:

```bash
cd backend
npx tsx src/scripts/migrateEmotionPalette.ts
```

## Current triples (reference)

| emotion | color | color2 | color3 |
|--------|--------|--------|--------|
| happy | `#FFD166` | `#FFB703` | `#FB8500` |
| sad | `#BFDBFE` | `#60A5FA` | `#2563EB` |
| anxious | `#FEF3C7` | `#F59E0B` | `#EA580C` |
| calmness | `#CCFBF1` | `#2DD4BF` | `#059669` |
| angry | `#FECACA` | `#EF4444` | `#B91C1C` |
| scared | `#DDD6FE` | `#8B5CF6` | `#4C1D95` |
| loved | `#FBCFE8` | `#EC4899` | `#BE185D` |
| neutral | `#E0E7FF` | `#A5B4FC` | `#6366F1` |
| tired | `#A5B4FC` | `#4F46E5` | `#312E81` |
| apathy | `#EDE9FE` | `#C4B5FD` | `#6D28D9` |
| melancholy | `#C7D2FE` | `#818CF8` | `#4338CA` |
| inspiration | `#E9D5FF` | `#A855F7` | `#7E22CE` |
| drive | `#FED7AA` | `#FB923C` | `#C2410C` |
| excited | `#FEF08A` | `#FACC15` | `#CA8A04` |

If this table drifts from the source files, trust the TypeScript/Python sources.

## Display modes (frontend only)

Users can choose how gradients are rendered in **Settings → Mood gradients** (`moodie_mood_gradient_mode` in `localStorage`):

| Mode | Behavior |
|------|----------|
| **Auto** (default) | Light theme: pastel (mix toward white). Dark theme: softer hues (mix toward dark card background `#1a222c`). |
| **Vivid** | Exact palette colors everywhere. |
| **Pastel** | Always pastel, in any theme. |

Implementation: `frontend/src/ui/moodGradientStyle.ts`.
