---
name: Kinetic Neon
colors:
  surface: '#13131a'
  surface-dim: '#13131a'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ec'
  on-surface-variant: '#e2bdc3'
  inverse-surface: '#e4e1ec'
  inverse-on-surface: '#303038'
  outline: '#aa888e'
  outline-variant: '#5a4045'
  surface-tint: '#ffb1c1'
  primary: '#ffb1c1'
  on-primary: '#66002a'
  primary-container: '#ff4c85'
  on-primary-container: '#5a0024'
  inverse-primary: '#bb0053'
  secondary: '#ffb68d'
  on-secondary: '#532200'
  secondary-container: '#b95502'
  on-secondary-container: '#fff7f4'
  tertiary: '#d0bcff'
  on-tertiary: '#3c0091'
  tertiary-container: '#a078ff'
  on-tertiary-container: '#340080'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd9df'
  primary-fixed-dim: '#ffb1c1'
  on-primary-fixed: '#3f0017'
  on-primary-fixed-variant: '#90003e'
  secondary-fixed: '#ffdbc9'
  secondary-fixed-dim: '#ffb68d'
  on-secondary-fixed: '#321200'
  on-secondary-fixed-variant: '#763300'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#13131a'
  on-background: '#e4e1ec'
  surface-variant: '#34343d'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  code-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system crafts an immersive, high-velocity creative suite tailored for digital storytellers, short-form video editors, and mobile content creators producing for Reels, TikTok, and YouTube Shorts. The product projects the confidence of an elite post-production suite condensed into a lightning-fast mobile studio.

The visual direction merges **Cinematic Dark UI** with **High-Octane Gradient Energy**:
- **Deep Immersion:** Abyss-like canvas levels allow user media and high-saturation preview renders to command absolute visual focus.
- **Electric Tactility:** Interactive touch triggers vibrate with luminous neon gradients, soft atmospheric glows, and precise haptic-weight borders.
- **Creator-Centric Ergonomics:** Built explicitly for single-thumb mobile interaction, high frame rate previews, scrubber density, and fast generation cycles.

## Colors

The palette establishes an ultra-deep canvas punctuated by high-frequency spectral light:

- **Canvas & Surface Architecture:**
  - Canvas Root: `#0B0B0F` (True Obsidian)
  - Surface Level 1 (Base Cards, Dock, Sheets): `#181820`
  - Surface Level 2 (Nested Tooling, Hover, Scrubber Plates): `#22222E`
  - Surface Stroke / Hairlines: `#2E2E3E`
  - Surface Highlight Overlay: `rgba(255, 255, 255, 0.04)`

- **Accent Chromatics:**
  - Primary Energy: `#FF3D7F` (Electric Magenta / Vivid Pink)
  - Secondary Velocity: `#FF8A3D` (Solar Amber / Warm Orange)
  - Atmospheric Glow / AI Intelligence: `#8B5CF6` (Hyper Violet)
  - Active Gradient Key: Linear `135deg` from `#FF3D7F` to `#FF8A3D`
  - Radial Glow Tint: `rgba(139, 92, 246, 0.25)` feathered over backdrop layers

- **Typography & Iconography:**
  - High Emphasis: `#FFFFFF`
  - Mid Emphasis / Secondary Metadata: `#A2A2BA`
  - Low Emphasis / Disabled / Scrubber Tracks: `#5E5E76`

## Typography

The typography system relies on crisp, high-legibility geometric sans-serif construction with robust Korean and Latin glyph pairing (Pretendard / Plus Jakarta Sans). 

- **Weight Distinctions:** Headlines utilize ExtraBold (800) and Bold (700) to stand out sharply against cinematic video textures. Interactive controls and badges leverage SemiBold (600) for instant legibility in motion.
- **Letter Spacing:** Headlines under 24px use `-0.01em` tracking to keep titles compact. Micro-labels and timecodes leverage `+0.02em` tracking for legibility during scrubbing and live rendering.
- **Video Overlays:** Any typography rendered over active video frames defaults to Medium (500) or SemiBold (600) with soft drop shadows (`0 2px 8px rgba(0,0,0,0.8)`) to preserve read ratios regardless of underlying footage brightness.

## Layout & Spacing

The layout is built upon an 8pt mobile grid optimized for vertical 9:16 aspect ratio viewing:

- **Mobile Viewport Structure:**
  - Outer screen horizontal margin: `1rem` (16px) on mobile viewports; scales to `1.5rem` on wide tablets.
  - Video Preview Safe Areas: Strict adherence to bottom navigation clearance (84px floating island clearance) and top system notch reserves (44px).
  - Column Grid: Fluid 4-column structure for mobile asset browsers and project pickers; expandable to 8-column split on folding devices and tablets.
- **Density Management:**
  - Ultra-compact padding (`0.25rem` to `0.5rem`) within audio waveforms, timeline tracks, and keyframe markers.
  - Generous thumb-reach padding (`1rem` to `1.5rem`) around primary capture, trigger, and AI generation buttons.

## Elevation & Depth

Visual hierarchy is maintained without heavy physical drop shadows by pairing tonal depth, luminescent borders, and vibrant lighting:

- **Level 0 (Canvas Base):** Deep flat `#0B0B0F`. No elevation.
- **Level 1 (Dock, Modals, Cards):** `#181820` with a 1px continuous hairline stroke of `#2E2E3E`. 
- **Level 2 (Popovers, Scrubbers, Asset Trays):** `#22222E` layered with `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.56)`.
- **Level 3 (AI Action & Primary Focus):** Gradient elements radiate a dual atmospheric halo:
  - Spread shadow: `0 8px 24px rgba(255, 61, 127, 0.35)`
  - Ambient base glow: `0 0 40px rgba(139, 92, 246, 0.2)`
- **Glassmorphism:** Bottom sheets and floating navigation bars employ `backdrop-filter: blur(20px)` over `rgba(24, 24, 32, 0.75)` with top-border highlights using `rgba(255, 255, 255, 0.12)`.

## Shapes

The design system embraces an ultra-soft, fluid silhouette that mimics physical modern consumer hardware:

- **Containers & Feed Cards:** Use large radii (`rounded-2xl` / 16px to `rounded-3xl` / 24px) to soften the perimeter around high-contrast video footage.
- **Interactive Badges & Tool Pills:** Pill-shaped (`rounded-full` / 9999px) form factor for tags, state badges, preset chips, and floating playback controls.
- **Modal Sheets:** Rounded top corners of 28px (`rounded-t-[28px]`) with an integrated pill drag indicator (36px width, 4px height, `#5E5E76`).

## Components

### Buttons
- **Primary AI Action Button:** Full pill-shaped, linear gradient (`#FF3D7F` to `#FF8A3D`), crisp white SemiBold typography. Features a soft outer pulse glow (`rgba(255, 61, 127, 0.3)`). Active press state compresses to `scale(0.97)`.
- **Secondary Tool Button:** Surface background (`#22222E`), border (`#2E2E3E`), high-emphasis text. On active state, border illuminates with `#FF3D7F`.
- **Icon Action Buttons (Canvas Controls):** 44x44px circular pills with `rgba(24, 24, 32, 0.6)` blur backdrop, 1px perimeter border, housing high-contrast iconography.

### Floating Bottom Navigation Bar
- A detached floating navigation dock suspended 16px above the home indicator.
- Glassmorphic finish (`rgba(24, 24, 32, 0.85)` with 24px blur and `#2E2E3E` border).
- **Central Action Trigger:** Over-sized 56px circular button bursting out of the bar centerline. Gradient fill (`#FF3D7F` to `#FF8A3D`), housing an icon or AI spark indicator, elevated with a prominent neon drop-halo.

### Chips & Filter Pills
- Pill-shaped status items (`px-3 py-1.5`).
- Unselected: `#181820` surface with `#2E2E3E` border and mid-emphasis label.
- Selected: Subtle gradient tint background (`rgba(255, 61, 127, 0.12)`), solid 1px gradient border, high-emphasis text with subtle magenta glow.

### Cards & Project Tiles
- Base `#181820` fill, 20px corner radius, encased in a 1px `#2E2E3E` stroke.
- Media thumbnail occupies top aspect with a seamless interior mask.
- Bottom metadata contains duration pill badges (`rgba(11, 11, 15, 0.7)` backdrop) and quick-action ellipsis triggers.

### Text Inputs & Prompt Bars
- Pill or 16px soft-rectangle input containers. Background `#181820`, border `#2E2E3E`.
- Focus state activates an outer ring of violet/pink light (`0 0 0 2px #FF3D7F`).
- Integrated inline trailing action: Mini circular gradient trigger for immediate AI prompt dispatch.

### Checkboxes, Toggles & Radios
- Toggles utilize smooth pill capsules: Inactive track `#22222E`, active track gradient `#FF3D7F` to `#FF8A3D` with an offset white circular knob.
- Checkboxes: 20px rounded squares (6px corner radius), checking initiates a solid magenta fill with a crisp white tick mark.