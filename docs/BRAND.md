# ONTRACK identity

Make room for what matters.

The mark is a continuous rounded track with an inner lane. It represents steady progress and a place to return to, rather than a target or performance badge. The lowercase wordmark uses Manrope with tight, deliberate spacing. The same mark appears in navigation, account entry, favicon and app icon.

| Role | Colour |
| --- | --- |
| Canvas | Charcoal `#171817` |
| Surface | Soft charcoal `#20221f` |
| Main text / focus panel | Warm paper `#eeeade` / moss charcoal `#242820` |
| Secondary text | Warm grey `#aaada0` |
| Action / selection | Yellow `#f2d44b` |
| Supporting surfaces | Dark oat and sage |

Use yellow for clear actions and small highlights. Use charcoal text on yellow. Keep ordinary working surfaces quiet. Today has one dominant focus panel; upcoming work uses open rows; plans use a distinct collection layout. Do not repeat the same card treatment for every section.

Navigation uses a consistent SVG icon family with visible labels. Desktop has a fixed rail; small screens have a bottom dock and reserve space for it. Plans opens a collection with search and status filters before opening its editor. All destinations share the same header, typography and controls.

Manrope is bundled locally through Fontsource under its OFL licence. The offline build embeds its font files. Brand assets are `public/ontrack-mark.svg` and `public/ontrack-icon.svg`; UI SVG definitions live in `src/identity.ts`. Screen rules live in `src/redesign-layer.css`, replacing the previous competing rebrand layers.

Dark mode is the app's default, including account entry, native controls, sheets and installed-app chrome. Film grain is a small tiled SVG noise texture; sparse dust drifts behind working content and does not capture pointer events. GSAP animates view-entry headings and cards, and gently resolves uploaded/training imagery into place. It does not split or replace accessible text. Reveals run once per view, avoid replay on focus/completion updates and clean up removed views. Reduced-motion preferences disable JavaScript motion as well as CSS motion; hidden tabs pause the dust.

Training banners use small abstract SVG artwork in the same palette, replacing truncated WebP assets. Vite embeds the SVGs, including in the offline build. Browser checks require full image decoding for all three workout days, rather than relying on readable image headers alone.

Image frames resize with their own container. Vault references and cover-picker previews show the entire image without stretching; filenames and delete controls sit below Vault images. Gallery columns adapt to the available width, including narrow desktop workspaces. Decorative goal covers keep a deliberate crop (square on small screens, 4:3 on desktop), while media strips scroll within their panel. Workout artwork uses a 16:9 frame capped to the screen height, with type sized to the actual banner width. Selected covers retain their image node during unrelated UI updates so resizing does not restart motion. Responsive checks cover 320–2560px widths, tablet layouts and short landscape screens using portrait, landscape and panoramic files.

The planner accepts up to 25,000 characters. Multi-section authored lists import without AI rewriting: every numbered action is preserved, and tables, calculations, links and other text stay in section notes. All sections are reviewed before a single batch save. Imports deliberately book no calendar sessions. Freeform AI planning supports multiple plans with validation, bounded requests and explicit quota/configuration/timeout errors; an explicit text-import action remains available when AI fails. Original dates and financial figures remain user-authored assumptions.

Account data, existing plan records, uploaded media, calendar storage and authentication methods remain intact. The separate legacy/dated calendar issue recorded in UI-AUDIT.md remains outside the rebrand.
