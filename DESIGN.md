---
name: Clean Counter POS
description: A high-performance, light-themed visual system for low-spec cashier touchscreens.
colors:
  primary: "#ea580c"
  secondary: "#16a34a"
  tertiary: "#d97706"
  neutral-bg: "#f4f4f5"
  neutral-surface: "#ffffff"
  ink-main: "#18181b"
  ink-muted: "#71717a"
  border-clean: "#e4e4e7"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.ink-main}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
---

# Design System: Clean Counter POS

## 1. Overview

**Creative North Star: "The Clean Counter"**

A high-contrast, light-themed visual layout optimized for touchscreens and low-spec hardware. The design prioritizes speed and absolute legibility. Rather than using modern styling bells and whistles (like complex CSS animations, dropshadows, or backdrop filters), the Clean Counter POS uses distinct layout panels, fine borders, and clear typographic hierarchy. This keeps rendering costs minimal so that cashiers experience zero layout lag during checkout operations.

### Key Characteristics:
* **Light Theme Canvas**: Bright backgrounds that stay readable under bright counter lighting.
* **No-Shadow Elevation**: Spatial depth is conveyed through subtle container borders and contrasting white/gray layers, avoiding CPU-heavy rendering.
* **Zero Transition Overhead**: Immediate response triggers without delay-inducing CSS transitions.

## 2. Colors

A high-contrast, bright color system utilizing daylight-level neutral scales and saturated action accents.

### Primary
* **Daylight Orange** (`#ea580c`): Used for primary action indicators, category selections, and highlight state markers.

### Secondary
* **Checkout Green** (`#16a34a`): Used for cart totals, success banners, checkout actions, and discount indicators.

### Tertiary
* **Edit Amber** (`#d97706`): Used for pending edit banners, warnings, and secondary order-modification modes.

### Neutral
* **Base Canvas** (`#f4f4f5`): Light zinc gray used as the application main background.
* **Surface Container** (`#ffffff`): Pure white used for the interactive menu grid, modifier sheets, and cashier sidebar.
* **Deep Ink** (`#18181b`): High-contrast near-black for headings and main details.
* **Muted Ink** (`#71717a`): Medium gray for supporting metadata, subheadings, and item notes.
* **Fine Border** (`#e4e4e7`): Subtle divider lines between grid cards and panel layouts.

### Named Rules
**The Performant Contrast Rule.** Background colors must only transition between base canvas `#f4f4f5` and card surfaces `#ffffff`. Never use gradients, textured layers, or semi-transparent gray scales that complicate text rendering.

## 3. Typography

**Display Font:** System Sans-Serif (`ui-sans-serif, system-ui, -apple-system, sans-serif`)
**Body Font:** System Sans-Serif (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** Receipt Monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`)

### Hierarchy
* **Display** (Bold (900), 1.5rem (24px), 1.2): Title headers of panels and major item headings.
* **Headline** (Bold (700), 1.125rem (18px), 1.3): Category indicators and modal headers.
* **Title** (Semibold (600), 1rem (16px), 1.4): Item names, cart totals, and primary button labels.
* **Body** (Regular (400), 0.875rem (14px), 1.5): Descriptions, note labels, and option checkboxes. Line length is capped at 65ch.
* **Label** (Medium (500), 0.75rem (12px), 1.2): Timestamps, table numbers, and modifier extra prices.

## 4. Elevation

The visual system is entirely flat. We avoid shadows, box-shadows, and layout layers to ensure rendering compatibility on older hardware configurations.

### Named Rules
**The Flat Separation Rule.** Depth and containment are defined exclusively by 1px solid borders (`#e4e4e7`) and clean white surface cards set against the light zinc backdrop.

## 5. Components

### Buttons
* **Shape**: Curved borders (12px / `rounded-xl`).
* **Primary**: Saturated background fill with white text.
* **Secondary**: Outlined border (1px solid `#e4e4e7`) with Deep Ink text.
* **Hover / Active State**: Immediate background swap without transitions.

### Cards / Containers
* **Corner Style**: Rounded corners (16px / `rounded-2xl`).
* **Background**: Pure white (`#ffffff`).
* **Border**: Fine border (1px solid `#e4e4e7`).

### Inputs / Fields
* **Style**: Pure white background, fine gray border (`#d4d4d8`).
* **Focus**: Saturated orange outline (2px solid `#ea580c`).

## 6. Do's and Don'ts

### Do:
* **Do** use high-contrast Deep Ink text on bright backgrounds to maximize screen readability under ambient store light.
* **Do** verify touch target sizes remain above 44px to accommodate quick physical selections.
* **Do** keep receipt formatting strictly in monospace font for accurate vertical column alignment.

### Don't:
* **Don't** use box-shadows, blurred backdrop panels, or glassmorphic gradients.
* **Don't** use transition durations or delay keyframes that introduce visual input latency.
* **Don't** use dark gray or saturated black backgrounds for main containers (avoids screen reflection/glare).
