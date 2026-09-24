# Veylo UI/UX audit protocol

Veylo's UI is reviewed as a communication product, not as a generic dashboard.

## 1. Heuristic review

Use the Nielsen Norman Group usability heuristics as the manual baseline:

- system status must be visible;
- the interface should use language familiar to users;
- users need clear control and recovery;
- prevent errors where possible;
- prefer recognition over recall;
- keep screens focused on the current task;
- errors should explain what happened and what to do next.

## 2. Accessibility and mobile ergonomics

WCAG 2.2 is the standards baseline. Veylo keeps a stricter product rule for frequent interactive controls:

- clear keyboard focus using `:focus-visible`;
- minimum 44 × 44 CSS px target for primary/compact controls where practical;
- no critical state communicated by color alone;
- readable type at mobile widths;
- reduced-motion support;
- disabled controls remain visibly distinct.

Run:

```bash
pnpm audit:ui
```

## 3. Anti-slop design-smell review

There is no authoritative automatic "AI slop detector". For Veylo, the term is operationalized into concrete smells that can be reviewed repeatedly:

- decorative gradients or glowing blobs without information value;
- glassmorphism/blur used as a default panel treatment;
- every piece of content placed in a rounded card;
- pill buttons used everywhere regardless of hierarchy;
- fake metrics, charts, dashboards, testimonials, or activity feeds;
- decorative motion that shifts layout or distracts from conversation;
- excessive shadows and layered floating surfaces;
- tiny uppercase labels used as visual filler;
- generic marketing language that does not describe what Veylo actually does.

The product should derive hierarchy primarily from typography, spacing, alignment, grouping, state, and restrained contrast.

## 4. Browser evidence

The `UI Review` GitHub Actions workflow builds the real applications and captures:

- public site — desktop and mobile;
- app onboarding — desktop and mobile;
- Face-to-Face — desktop;
- AI Simulation — desktop.

It also runs Lighthouse against the built public site and app onboarding screen. Accessibility and best-practice scores must be at least 90. Public SEO must also be at least 90.

Screenshot artifacts are not merely CI decoration. They are intended for human/AI visual review after meaningful UI changes.

## 5. Human task test

Automation cannot certify that a communication interface feels natural. Before production acceptance, perform short task tests:

1. New visitor: identify what Veylo does and start the correct mode without explanation.
2. Live Call: create/join a room, identify connection state, change listener language, and leave the call.
3. Face-to-Face: choose microphone/output, understand whose turn is being interpreted, and recover from a recognition/translation failure.
4. Simulation: select scenario, speak, understand the reply, and export/restore the session.
5. Mobile: perform the same primary task one-handed without precision tapping or horizontal scrolling.

Record observed hesitation, misclicks, unclear labels, and recovery failures. Fix those findings before changing visual decoration.

## Review principle

Passing Lighthouse or a source gate means the interface meets selected measurable checks. It does **not** mean the UI is automatically good. Final acceptance combines source checks, rendered screenshots, accessibility tooling, heuristic review, and real task observation.
