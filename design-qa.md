# Bookmark grid and sidebar QA

## Comparison target

- Source visual truth:
  - `/var/folders/d_/nkcw51h14gs0t728pnkh39nc0000gn/T/codex-clipboard-8797a1ac-77ff-492c-bca6-7f02da283bef.png` — narrow folder sidebar.
  - `/var/folders/d_/nkcw51h14gs0t728pnkh39nc0000gn/T/codex-clipboard-7e44e3a7-7c79-410e-8b49-1acf682eca87.png` — list/grid selector.
  - `/var/folders/d_/nkcw51h14gs0t728pnkh39nc0000gn/T/codex-clipboard-a8d5a64c-1fa8-489f-8804-7955d6bd911c.png` — bookmark card grid.
- Instructional visual deltas: widen the sidebar, remove list mode, make grid the only view, provide direct card placement, and use four columns on wide desktop.
- Browser-rendered implementation captures:
  - `/tmp/bookmark-mobile-sidebar-wide-final.png` — 375 × 812 CSS px, mobile folder drawer open.
  - `/tmp/bookmark-grid-1024-final.png` — 1024 × 768 CSS px, desktop tablet-width fallback.
  - `/tmp/bookmark-grid-1280-final.png` — 1280 × 900 CSS px, four-column desktop grid.
  - `/tmp/bookmark-grid-2048-final.png` — 2048 × 1228 CSS px, wide desktop grid.

Source pixel dimensions were 548 × 578, 208 × 176, and 2890 × 1724. Their browser CSS sizes and device densities were not supplied, so comparison used native-pixel visual regions without density scaling rather than asserting a pixel-perfect frame match. Implementation captures use CSS pixels at browser device scale factor 1.

## Evidence and states

- Full-view comparison opened the wide-grid source and the 2048 × 1228 implementation together. The implementation intentionally changes the source’s three-column, sequential presentation to four equal 345px tracks, per the request.
- Focused comparison opened the narrow-sidebar source and the 375 × 812 drawer together. The selected `idghst.co.kr` label is no longer truncated; the drawer measures 320px and leaves a visible dismissible scrim.
- Focused comparison opened the view-selector source and the final desktop header. No list/grid selector remains; the header has only search, favorites, and add controls.
- Grid position affordance: every desktop card exposes a visible `GripVertical` handle with the tooltip `드래그해서 위치 변경`. Existing same-folder, same-section drag/drop persists through `/api/bookmarks/reorder`.
- Responsive checks: 375px drawer has no horizontal overflow; 1024px uses two 325.5px tracks to protect readable cards; 1280px and wider use four tracks (206.45px at 1280px, 345px at 2048px). Sidebar width is 320px at 1024px and 352px at 1280px and above, with no scroll-width overflow.
- Browser console errors: none in the final 2048px state.

## Findings

- [P2, fixed] Four columns at 1024px squeezed cards to roughly 157px, causing substantial title and tag truncation.
  - Fix: retain the requested four columns from `xl` upward and use two columns at `lg` widths. The 1024px capture now has two 325.5px tracks; 1280px and 2048px retain four columns.
- [P2, fixed] The original mobile drawer truncated the selected folder name.
  - Fix: increase the drawer from 288px to 320px while capping it to `calc(100vw - 1rem)`. The final 375px capture shows the complete `idghst.co.kr` label.

## Required fidelity surfaces

- Fonts and typography: existing Pretendard hierarchy, weights, truncation behavior, and card text scale are retained. Four-column desktop cards preserve the existing title/host hierarchy.
- Spacing and layout rhythm: sidebar width is increased without changing row height or tree indentation; wide grids use equal tracks and the existing 12px gap.
- Colors and visual tokens: brand purple, white surfaces, subtle borders, selected states, and destructive controls are unchanged.
- Image quality and asset fidelity: no visual image assets were added or replaced. Existing favicon loading behavior remains unchanged.
- Copy and content: list-mode copy is removed with its control; drag affordance uses concise Korean copy.
- Icons and interaction: the existing Lucide icon family is retained. The new persistent grip makes card reordering discoverable, while edit/delete remain hover or focus actions.
- Accessibility and responsiveness: the drag description is exposed to assistive technology; card focus still exposes edit/delete controls. Mobile retains its drawer and single-column cards; wide desktop provides four columns.

## Interaction and automated checks

- Existing same-section reorder, API payload, rollback, and overlapping-mutation tests continue to pass; the added test asserts grid-only rendering, four-column desktop classes, and the visible drag affordance.
- `PATH=/opt/homebrew/bin:$PATH pnpm verify`: passed — typecheck, 65 tests, and production build.

## Open questions

- This implementation treats “custom position” as drag-and-drop order within the same folder and section, which is persisted as `position`. Preserving intentionally empty cells or arbitrary row/column coordinates would require a separate grid-coordinate data model.

## Implementation checklist

1. Keep grid-only presentation and the responsive four-column wide-desktop breakpoint.
2. Keep the existing persisted `position` reorder contract for card placement.
3. Keep sidebar width constrained on small screens and widened on desktop.

## Follow-up polish

- None required for the requested scope.

final result: passed
