# Typist Design Tokens

Warm-minimal light theme. One accent color, warm stone neutrals, Space Grotesk
for display type, Inter for body, JetBrains Mono for anything the machine says
(hotkeys, memory keys, percentages).

## Colors

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#faf9f7` | app background (paper) |
| `--surface` | `#ffffff` | cards, header, footer, inputs |
| `--ink` | `#1c1917` | primary text |
| `--ink-60` | `#57534e` | secondary text |
| `--ink-40` | `#a8a29e` | hints, section labels, placeholders |
| `--border` | `#e7e5e4` | default borders (1.5px) |
| `--border-strong` | `#d6d3d1` | hover borders |
| `--accent` | `#c8102e` | brand crimson — the only accent |
| `--accent-hover` | `#a90d27` | primary button hover |
| `--accent-soft` | `#fdf0f1` | selected card background |
| `--accent-border` | `#f3c1c8` | selected badge/chip border |
| `--ok` | `#16a34a` | success states |
| `--ok-soft` / `--ok-border` | `#f0fdf4` / `#bbf7d0` | status chip (ready) |

## Typography

- Display: `'Space Grotesk'` — wordmark (26px/700), section labels (11px/600, uppercase, 0.1em tracking)
- Body: `'Inter'` — 14px base, 1.5 line-height
- Mono: `'JetBrains Mono'` — kbd, memory keys, download percentages

## Shape

- Radius: 12px cards, 10px inputs/buttons, 999px pills/chips/badges
- Borders: 1.5px; selected state = accent border + `--accent-soft` fill
- Focus: accent border + `0 0 0 3px rgba(200,16,46,0.1)` ring
- Buttons: primary = solid accent; ghost = surface + border, hover to `--bg`

## Overlay pill

Light pill (`rgba(250,249,247,0.98)`), crimson waveform bars / spinner ring /
sparkle, green ✓ for done, crimson text for errors. Height 44px, radius 999px,
shadow `0 10px 28px rgba(0,0,0,0.22)`.

## Motion

Respect `prefers-reduced-motion`. Animations: 1s waveform eq, 0.7s spinner,
1.2s sparkle pulse, 2s status-chip pulse.
