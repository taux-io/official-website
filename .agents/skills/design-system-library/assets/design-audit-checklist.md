# Design Compliance Audit Checklist (Reviewer Pattern)

> **Instructions**: For each item, compare the generated UI against the loaded DESIGN.md reference. Mark severity and note findings.
>
> Severity Levels:
> - 🔴 **Critical**: Violates a "Don't" rule or breaks visual identity — must fix before shipping
> - 🟡 **Warning**: Deviates from recommended but not destructive — should fix
> - 🟢 **Pass**: Matches the design system specification

---

## 1. Color Token Compliance

- [ ] **Primary colors** match DESIGN.md hex values exactly (not "close enough")
- [ ] **No unapproved colors** introduced (check against the color palette section)
- [ ] **Accent colors used in correct context** (e.g., Vercel workflow colors only in workflow context)
- [ ] **Background/foreground contrast** meets WCAG AA ratio (≥ 4.5:1 for normal text, ≥ 3:1 for large text)
- [ ] **Dark/light mode** tokens applied correctly if applicable

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 2. Typography Hierarchy

- [ ] **Font family** matches DESIGN.md specification (including fallback stack)
- [ ] **Font weights** stay within the allowed range (e.g., Vercel: 400/500/600 only; Stripe: 300/400 only)
- [ ] **Letter-spacing** follows progressive scale (tighter at larger sizes, relaxing downward)
- [ ] **Line-height** matches specified values for each text role
- [ ] **OpenType features** enabled where required (`"liga"`, `"ss01"`, `"tnum"`)
- [ ] **No unauthorized bold** (check if 700 is allowed or forbidden)

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 3. Shadow System

- [ ] **Shadow technique** matches DESIGN.md (e.g., shadow-as-border vs traditional border)
- [ ] **Shadow color** uses brand-specific tint if specified (e.g., Stripe: `rgba(50,50,93,0.25)`)
- [ ] **Multi-layer shadows** include all required layers (border + elevation + ambient + inner highlight)
- [ ] **Shadow depth** appropriate for component elevation level
- [ ] **No unauthorized heavy shadows** (check max opacity allowed)

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 4. Spacing & Layout

- [ ] **Base spacing unit** followed consistently
- [ ] **Container max-width** matches DESIGN.md specification
- [ ] **Section spacing** uses specified vertical padding ranges
- [ ] **Whitespace philosophy** honored (e.g., Vercel's "gallery emptiness", Stripe's "precision spacing")
- [ ] **Grid columns** match specified breakpoint behavior

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 5. Component Specifications

- [ ] **Border-radius** within allowed range (e.g., Stripe: 4-8px only, no pills)
- [ ] **Button styles** match specification (padding, radius, shadow, font weight)
- [ ] **Card treatment** uses correct border/shadow technique
- [ ] **Navigation** follows specified structure and color
- [ ] **Badge/pill** styles match (radius, padding, font size)

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 6. Responsive Behavior

- [ ] **Breakpoints** match DESIGN.md specified widths
- [ ] **Collapsing strategy** followed (columns → stacked, etc.)
- [ ] **Typography scaling** correct across breakpoints
- [ ] **Touch targets** meet minimum size requirements
- [ ] **Mobile menu** behavior correct (if applicable)

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 7. Do's and Don'ts Compliance

- [ ] **All "Do" items** adhered to
- [ ] **No "Don't" items** violated
- [ ] **Specific forbidden patterns** checked:
  - No unauthorized font weights
  - No unauthorized border radius values
  - No decorative use of functional colors
  - No positive letter-spacing where negative is required

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## 8. Accessibility

- [ ] **Semantic HTML** used (not div-soup)
- [ ] **Heading hierarchy** logical (h1 → h2 → h3, no skips)
- [ ] **Focus states** visible and match DESIGN.md focus ring specification
- [ ] **Alt text** on images
- [ ] **ARIA labels** on interactive elements
- [ ] **Keyboard navigation** functional

**Findings**: `{{ SEVERITY }} — {{ DESCRIPTION }}`

---

## Audit Summary

| Category | Status | Critical Count | Warning Count |
|----------|--------|---------------|---------------|
| Color Tokens | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Typography | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Shadow System | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Spacing & Layout | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Components | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Responsive | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Do's/Don'ts | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |
| Accessibility | `{{ PASS/FAIL }}` | `{{ N }}` | `{{ N }}` |

**Overall Verdict**: `{{ APPROVED | NEEDS_REVISION | REJECTED }}`

**Action Items**:
1. `{{ Fix description }}`
2. `{{ Fix description }}`
