# Design Brief Interview Questions (Inversion Pattern)

> **Purpose**: Gather all required context BEFORE any design or code generation begins.
> **Rule**: Do NOT proceed to generation until all **Required** questions are answered.

---

## Required Questions (Must Answer)

### Q1: Design System Selection
> Which design aesthetic should this follow?

**Options**:
- `vercel` — Monochrome precision, Geist font, shadow-as-border
- `stripe` — Fintech premium, weight-300 elegance, blue-tinted shadows
- `linear` — Ultra-minimal, purple on dark, engineering-first
- `supabase` — Dark emerald, code-editor aesthetic, terminal-born
- `airbnb` — Warm coral, photography-driven, rounded friendly UI
- `notion` — Warm minimalism, serif headings, soft cream surfaces
- `taux` — TauX default: Monochrome + Cyan (#00F0FF), Simple & Clean Tech
- `custom` — User will provide their own specifications

**If "custom"**: Ask the user to provide at minimum: primary color, background color, font family, and border-radius preference.

---

### Q2: Component Type
> What type of UI component or page section are you building?

**Options**:
- `hero` — Hero/landing section with headline, subtitle, and CTA
- `card` — Content card with title, body, and optional image
- `navigation` — Header navigation bar with links and CTA
- `footer` — Page footer with links, social, and copyright
- `form` — Input form with labels, fields, and submit button
- `pricing` — Pricing table or comparison cards
- `feature-grid` — Feature showcase in grid layout
- `testimonial` — Customer quote or trust section
- `dashboard` — Data-rich panel with metrics
- `modal/dialog` — Overlay modal or dialog box
- `other` — Describe the component in detail

---

### Q3: Target Breakpoints
> Which screen sizes must this support?

**Options**:
- `mobile-first` — Start from mobile, scale up (recommended)
- `desktop-only` — Desktop viewport only
- `all` — Full responsive: mobile, tablet, and desktop

---

## Recommended Questions (Should Answer)

### Q4: Color Mode
> Light mode, dark mode, or both?

**Options**:
- `light` — Light background, dark text
- `dark` — Dark background, light text
- `both` — Support toggle between modes
- `auto` — Follow DESIGN.md default for selected brand

---

### Q5: Content Context
> What content will this component display?

Provide:
- Headline text (or placeholder intent)
- Body text (or placeholder intent)
- CTA label (if applicable)
- Image requirements (if applicable)
- Number of items (for grids/lists)

---

### Q6: Integration Constraints
> Are there existing constraints to respect?

- Existing CSS classes or Tailwind config to preserve?
- Existing colors/fonts already in the project?
- Maximum width constraint?
- Z-index layer concerns?
- Go template partials to integrate with?

---

## Optional Questions (Nice to Have)

### Q7: Animation Requirements
> Any motion/interaction requirements?

- Hover effects needed?
- Entrance animations?
- Scroll-triggered animations?
- Transition durations preference?

---

### Q8: Accessibility Requirements
> Beyond standard compliance:

- Screen reader optimization level?
- Motor disability considerations?
- High contrast mode support?
- Specific ARIA pattern required?

---

## Design Brief Output Template

After all required questions are answered, produce this brief:

```markdown
# Design Brief: {{ COMPONENT_NAME }}

- **Design System**: {{ BRAND_ID }} (references/{{ BRAND_ID }}.md)
- **Component Type**: {{ TYPE }}
- **Target**: {{ BREAKPOINTS }}
- **Color Mode**: {{ MODE }}
- **Content**: {{ SUMMARY }}
- **Constraints**: {{ CONSTRAINTS }}
- **Animation**: {{ REQUIREMENTS }}
- **Accessibility**: {{ REQUIREMENTS }}

## Approved to proceed: ✅
```
