# Component Specification Template (Generator Pattern)

> **Instructions**: Fill in ALL sections below. Do not skip any field. Use exact CSS values from the loaded DESIGN.md reference.

---

## 1. Component Identity

- **Component Name**: `{{ COMPONENT_NAME }}`
- **Design System Source**: `{{ BRAND_NAME }}` (`references/{{ BRAND_ID }}.md`)
- **Component Type**: `{{ hero | card | navigation | form | badge | footer | section | modal }}`
- **Target Breakpoints**: `{{ mobile | tablet | desktop | all }}`

---

## 2. Design Tokens Applied

### Colors
| Role | Token | Value |
|------|-------|-------|
| Background | `{{ TOKEN_NAME }}` | `{{ HEX_VALUE }}` |
| Text Primary | `{{ TOKEN_NAME }}` | `{{ HEX_VALUE }}` |
| Text Secondary | `{{ TOKEN_NAME }}` | `{{ HEX_VALUE }}` |
| Accent/CTA | `{{ TOKEN_NAME }}` | `{{ HEX_VALUE }}` |
| Border | `{{ TOKEN_NAME }}` | `{{ CSS_VALUE }}` |

### Typography
| Element | Font | Size | Weight | Line Height | Letter Spacing | Features |
|---------|------|------|--------|-------------|----------------|----------|
| Heading | `{{ FONT }}` | `{{ SIZE }}` | `{{ WEIGHT }}` | `{{ LH }}` | `{{ LS }}` | `{{ OT_FEATURES }}` |
| Body | `{{ FONT }}` | `{{ SIZE }}` | `{{ WEIGHT }}` | `{{ LH }}` | `{{ LS }}` | `{{ OT_FEATURES }}` |
| Caption | `{{ FONT }}` | `{{ SIZE }}` | `{{ WEIGHT }}` | `{{ LH }}` | `{{ LS }}` | `{{ OT_FEATURES }}` |

### Shadows & Elevation
| Level | CSS Value |
|-------|-----------|
| `{{ LEVEL_NAME }}` | `{{ SHADOW_CSS }}` |

### Spacing
- Padding: `{{ PADDING_VALUES }}`
- Gap: `{{ GAP_VALUES }}`
- Margin: `{{ MARGIN_VALUES }}`

### Border Radius
- `{{ RADIUS_VALUE }}` — `{{ PURPOSE }}`

---

## 3. HTML Structure

```html
<!-- Semantic HTML using Go template syntax -->
{{ define "{{ COMPONENT_NAME }}" }}
<{{ SEMANTIC_TAG }} id="{{ UNIQUE_ID }}" class="{{ TAILWIND_CLASSES }}">
  <!-- Component content here -->
</{{ SEMANTIC_TAG }}>
{{ end }}
```

---

## 4. Responsive Behavior

| Breakpoint | Layout Change |
|-----------|---------------|
| Mobile (<640px) | `{{ DESCRIPTION }}` |
| Tablet (640-1024px) | `{{ DESCRIPTION }}` |
| Desktop (>1024px) | `{{ DESCRIPTION }}` |

---

## 5. Accessibility

- [ ] Semantic HTML tags used (`<nav>`, `<main>`, `<section>`, `<article>`)
- [ ] `aria-label` on interactive elements
- [ ] Color contrast ratio ≥ 4.5:1 for body text
- [ ] Focus states defined with visible ring/outline
- [ ] Touch targets ≥ 44×44px on mobile

---

## 6. Tailwind Class Mapping

> Map each design token to its Tailwind equivalent. Use custom values via `[]` syntax for non-standard tokens.

```
Background:    {{ bg-white | bg-[#0f0f0f] | ... }}
Text Primary:  {{ text-[#171717] | text-white | ... }}
Font:          {{ font-['Geist'] | font-sans | ... }}
Shadow:        {{ shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] | ... }}
Radius:        {{ rounded-[6px] | rounded-lg | ... }}
```

---

## 7. Notes & Deviations

- `{{ Any intentional deviations from the DESIGN.md and why }}`
- `{{ Any TauX-specific adaptations (e.g., merging with Monochrome+Cyan palette) }}`
