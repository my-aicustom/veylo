# Responsive QA checklist

Test the site and app at minimum on:
- 360×800 phone
- 390×844 phone
- 768×1024 tablet portrait
- 1024×768 tablet / small laptop
- 1366×768 laptop
- 1440×900 desktop
- 1920×1080 desktop

Verify:
- no horizontal scroll;
- camera tiles do not hide core call controls;
- control targets remain >=44px;
- captions wrap without covering participant faces unnecessarily;
- safe-area insets on iOS are respected where needed;
- landscape phone mode remains usable;
- keyboard focus is always visible;
- reduced-motion mode is functional;
- Astro homepage remains readable with JavaScript disabled (motion is progressive enhancement).
