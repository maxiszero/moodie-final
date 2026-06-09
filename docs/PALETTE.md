# Moodie emotion palette

Canonical hex triples (`color`, `color2`, `color3`) are defined in:

| Location | File |
|----------|------|
| **Python API (canonical)** | `backend-py/app/services/palette.py` |
| Frontend cards / post gradients | `frontend/src/config/emotionPalette.ts` |

Aliases (e.g. `calm` → `calmness`, `inspired` → `inspiration`) live in `backend-py/app/services/palette.py`.

## When changing colors

1. Update `backend-py/app/services/palette.py` first.
2. Mirror the same keys in `frontend/src/config/emotionPalette.ts` and any literal fallbacks in `backend-py/app/services/ai.py`.
3. Update `frontend/src/config/emotionPalette.ts` (`ONBOARDING_EMOTION_CARDS`) and, if needed, `legacy.css` `--emotion-*` variables.
4. Optional: run a one-shot MongoDB update for old user/post documents if emotion triples changed (write a small Python migration script in `backend-py/scripts/` if needed).

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
