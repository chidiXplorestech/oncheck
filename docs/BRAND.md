# ONTRACK identity

Make room for what matters.

The mark is a continuous rounded track with an inner lane. It represents steady progress and a place to return to, rather than a target or performance badge. The lowercase wordmark uses Manrope with tight, deliberate spacing. The same mark appears in navigation, account entry, favicon and app icon.

| Role | Colour |
| --- | --- |
| Canvas | Ivory `#f6f5ef` |
| Surface | Warm white `#fffef9` |
| Main text / focus panel | Charcoal `#23241f` / `#252720` |
| Secondary text | Warm grey `#68695e` |
| Action / selection | Yellow `#f2d44b` |
| Supporting surfaces | Muted oat and sage |

Use yellow for clear actions and small highlights. Use charcoal text on yellow. Keep ordinary working surfaces quiet. Today has one dominant focus panel; upcoming work uses open rows; plans use a distinct collection layout. Do not repeat the same card treatment for every section.

Navigation uses a consistent SVG icon family with visible labels. Desktop has a fixed rail; small screens have a bottom dock and reserve space for it. Plans opens a collection with search and status filters before opening its editor. All destinations share the same header, typography and controls.

Manrope is bundled locally through Fontsource under its OFL licence. The offline build embeds its font files. Brand assets are `public/ontrack-mark.svg` and `public/ontrack-icon.svg`; UI SVG definitions live in `src/identity.ts`. Screen rules live in `src/redesign-layer.css`, replacing the previous competing rebrand layers.

Account data, existing plan records, uploaded media, calendar storage and authentication methods remain intact. The separate legacy/dated calendar issue recorded in UI-AUDIT.md remains outside the rebrand.
