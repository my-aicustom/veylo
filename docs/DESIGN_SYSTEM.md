# Veylo design system

## Direction

Editorial communication product, not an "AI dashboard". The interface should feel calm enough for a serious trade meeting and modern enough to be credible as a new communication tool.

## Rules

- Strong hierarchy through type scale and whitespace before decoration.
- One functional accent color; no rainbow gradients or glowing AI orbs.
- Motion communicates state or continuity. It must never delay a user action.
- No fake metrics, fabricated logos, testimonial placeholders, or decorative dashboards.
- Cards are used only when items are genuinely discrete objects.
- Prefer borders, alignment and rhythm over excessive shadows.
- Every animated element must respect `prefers-reduced-motion`.
- Minimum touch target: 44×44 CSS px.
- Important controls stay reachable on narrow mobile screens and short laptop viewports.

## Homepage motion

Current Astro homepage uses:
- short intersection-based reveal;
- subtle waveform activity;
- understated live-state pulse;
- hover movement limited to a few pixels;
- Astro ClientRouter for navigation continuity.

No third-party animation runtime is required.
