---
name: Design System Library
description: 提供來自 awesome-design-md 的設計系統知識庫，支援 Progressive Disclosure 按需載入各品牌的 DESIGN.md 設計規範。
---

# Design System Library (SKILL.md)

This skill provides a curated library of **DESIGN.md** design system documents extracted from popular websites. Each reference file contains complete visual specifications: color tokens, typography hierarchy, shadow systems, spacing scales, component patterns, responsive behavior, and Do's/Don'ts.

**Source**: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)

---

## 1. Progressive Disclosure Architecture

This skill follows the **ADK Progressive Disclosure** model to minimize token consumption:

| Level | What's Loaded | When |
|-------|--------------|------|
| **L1 (Metadata)** | The registry table below | At startup — always available |
| **L2 (Instructions)** | This SKILL.md file | When design work begins |
| **L3 (Resources)** | Individual `references/*.md` files | Only when a specific brand is selected |

> **CRITICAL RULE**: Never load more than **1 reference DESIGN.md** at a time. Each file is 14,000–22,000 bytes. Loading multiple files simultaneously will cause context overflow.

---

## 2. Design System Registry (L1)

| ID | Brand | Aesthetic Summary | File |
|----|-------|------------------|------|
| `vercel` | Vercel | Monochrome precision. Geist font with extreme negative letter-spacing. Shadow-as-border technique. Near-pure white canvas. | `references/vercel.md` |
| `stripe` | Stripe | Fintech premium. sohne-var weight 300 (whisper-light headlines). Blue-tinted multi-layer shadows. Deep navy headings. | `references/stripe.md` |
| `linear` | Linear | Ultra-minimal engineering tool. Purple accent on dark. Inter font, tight tracking. Glass-like depth system. | `references/linear.md` |
| `supabase` | Supabase | Dark emerald developer platform. Code-editor aesthetic. Green accent on deep black. Terminal-born sophistication. | `references/supabase.md` |
| `airbnb` | Airbnb | Warm consumer marketplace. Coral accent (`#FF385C`). Cereal font, photography-driven, rounded UI (12px radius). | `references/airbnb.md` |
| `notion` | Notion | Warm minimalism workspace. Serif headings (Lyon Display), soft cream surfaces, gentle shadows. Content-first. | `references/notion.md` |

---

## 3. Loading Protocol

### Keyword Detection
When user prompts contain brand-related keywords, load the corresponding DESIGN.md:

| Keywords | Load |
|----------|------|
| "vercel", "geist", "monochrome precision", "shadow-as-border" | `references/vercel.md` |
| "stripe", "fintech", "sohne", "purple gradient", "weight 300" | `references/stripe.md` |
| "linear", "engineering tool", "ultra-minimal", "purple dark" | `references/linear.md` |
| "supabase", "emerald", "dark dev", "postgres green", "code editor" | `references/supabase.md` |
| "airbnb", "coral", "travel", "warm rounded", "photography-driven" | `references/airbnb.md` |
| "notion", "serif heading", "warm workspace", "cream surface" | `references/notion.md` |

### Fallback Behavior
- If **no brand is specified**, present the L1 registry table and ask the user to select one.
- If the user requests a **custom** design system not in the library, proceed with user-provided specifications rather than forcing a reference.
- If the user says "TauX style", refer to the TauX project's own design system: **Monochrome + Cyan (`#00F0FF`)**, as defined in [SKILL.md (taux-core)](../taux-core/SKILL.md) Section 3C.

---

## 4. Reference File Structure

Each `references/*.md` file follows the [Google Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/) with these sections:

1. **Design Philosophy** — Narrative description of the brand's visual identity
2. **Key Characteristics** — Bullet list of defining traits
3. **Color Palette** — Primary, accent, neutral, surface, shadow colors with hex values
4. **Typography** — Font family, hierarchy table (role/size/weight/line-height/letter-spacing)
5. **Components** — Buttons, cards, inputs, navigation, badges specifications
6. **Spacing & Grid** — Base unit, scale, container widths, whitespace philosophy
7. **Elevation & Shadows** — Shadow levels table with CSS values
8. **Responsive** — Breakpoints, collapsing strategy, touch targets
9. **Do's and Don'ts** — Strict rules for maintaining the design system
10. **Example Component Prompts** — Ready-to-use prompts for AI generation
11. **Iteration Guide** — Numbered checklist for self-review

---

## 5. Usage Examples

### Example 1: "Build a hero section like Vercel"
```
1. Agent detects keyword "Vercel" → loads references/vercel.md
2. Extracts relevant tokens:
   - Font: Geist 48px weight 600, letter-spacing -2.4px
   - BG: #ffffff, Text: #171717
   - CTA: dark button #171717, 6px radius
3. Generates component using those tokens
```

### Example 2: "Design a pricing card with Stripe's aesthetic"
```
1. Agent detects keyword "Stripe" → loads references/stripe.md
2. Extracts card specs:
   - Shadow: rgba(50,50,93,0.25) 0px 30px 45px -30px
   - Radius: 6px, Border: 1px solid #e5edf5
   - Font: sohne-var weight 300, ss01
3. Generates component matching the shadow/typography system
```
