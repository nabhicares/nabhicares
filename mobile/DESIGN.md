# Design System Guidelines (Google Stitch Specification)

This design spec maps standard design tokens to Flutter code implementation guidelines, ensuring all role-based dashboards share a premium, visually cohesive identity.

---

## 1. Color Palette Tokens

| Token | HSL / Hex Code | Flutter Definition | Context & Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | `#2563EB` | `Color(0xFF2563EB)` | Hospital branding (Medical Blue), principal actions, tabs |
| **Secondary** | `#4F46E5` | `Color(0xFF4F46E5)` | Accent indicators, charts, stats categories |
| **Background**| `#F8FAFC` | `Color(0xFFF8FAFC)` | Primary page canvas background (off-white/slate-50) |
| **Surface** | `#FFFFFF` | `Colors.white` | Dashboard metric blocks, card layouts, dialog backdrops |
| **Success** | `#10B981` | `Color(0xFF10B981)` | Safe status levels, completed visits, stock ok flags |
| **Warning** | `#F59E0B` | `Color(0xFFF59E0B)` | Expiry notices, partial payment flags, pending reviews |
| **Critical** | `#EF4444` | `Color(0xFFEF4444)` | Out of stock warnings, high priority alerts |

---

## 2. Typography & Fonts

We leverage standard Google Fonts (specifically **Inter** or system default sans-serif):

*   **Display / Large Headers**: `FontWeight.w800` (bold/heavy), letter-spacing `-0.5`, color: `#0F172A` (Slate-900).
*   **Subheadings / Title**: `FontWeight.bold`, size `14` to `16`, color: `#0F172A`.
*   **Body Copy**: `FontWeight.normal`, color: `#475569` (Slate-700).
*   **Muted Labels**: `FontWeight.normal`, size `11` to `12`, color: `#94A3B8` (Slate-400).

---

## 3. Layout Grid & Spacing System

We utilize an **8-point responsive spacing grid** to manage screen paddings and alignments:

*   **Page Margin**: `EdgeInsets.all(20.0)` for general dashboard layouts; `EdgeInsets.all(24.0)` for modals.
*   **Card Internal Padding**: `EdgeInsets.all(16.0)` is the default container standard.
*   **Spacers**:
    *   Small: `8.0` (between titles and subtitles)
    *   Medium: `16.0` (between rows or form fields)
    *   Large: `24.0` to `28.0` (separating major content groups)

---

## 4. Component Shapes & Radius Tokens

All interactive surface blocks utilize rounded corner geometries:

*   **Buttons**: `BorderRadius.circular(12)`
*   **App Cards**: `BorderRadius.circular(12)`
*   **Form Text Fields**: `BorderRadius.circular(12)`
*   **Action Badges / Chips**: `BorderRadius.circular(8)`
