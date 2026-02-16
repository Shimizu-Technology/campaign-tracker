# CT-61 Comprehensive UI Overhaul Plan

## Leon's Feedback (Feb 16, 2026)
1. **Slow admin load in dev** — investigate, compare to other apps
2. **Inconsistent styling** — pages look different from each other
3. **Email page styling broken**
4. **Vetting + Duplicates pages** — no padding, full-width bleed
5. **War Room looks completely different** from other pages
6. **Precincts takes full width but Quotas doesn't** — inconsistent
7. **Light mode preferred** — older users, should be default (optional dark mode later)

## Root Cause Analysis

### Inconsistent page layouts
Pages use different wrapper patterns:
- `DashboardPage`: `p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto` ✅
- `UsersPage`: `max-w-5xl mx-auto px-4 py-6 space-y-6` ✅
- `VettingPage`: `space-y-6` only ❌ (no padding, no max-width)
- `DuplicatesPage`: `space-y-6` only ❌
- `WarRoomPage`: Custom dark theme throughout ❌
- `EmailPage`: Inconsistent ❌
- `SmsPage`: `space-y-4` only ❌
- `ImportPage`: `space-y-6` only ❌
- `EventsPage`: Inconsistent ❌
- `LeaderboardPage`: Inconsistent ❌
- `PollWatcherPage`: Inconsistent ❌
- `QRCodePage`: Inconsistent ❌
- `ScanFormPage`: Inconsistent ❌

### Theme: Dark → Light
Current CSS vars are all dark. Need to flip to LIGHT theme like Hafaloha V2.

**Reference: Hafaloha V2 AdminLayout** (`~/work/Hafaloha/web/src/layouts/AdminLayout.tsx`):
- Main bg: `bg-gray-100`
- Sidebar: `bg-white` with `shadow-xl`
- Header: `bg-white` with `border-b border-gray-200 shadow-sm`
- Cards: white bg
- Text: gray-900 primary, gray-600 secondary

## Implementation Plan

### Phase 1: CSS Variables → Light Theme
Update `index.css` CSS variables to light mode:
```css
:root {
  --campaign-blue: #1B3A6B;
  --campaign-red: #C41E3A;
  
  /* Light theme surfaces */
  --surface-bg: #f3f4f6;        /* gray-100 */
  --surface-raised: #ffffff;     /* white */
  --surface-overlay: #f9fafb;    /* gray-50 */
  
  /* Text */
  --text-primary: #111827;       /* gray-900 */
  --text-secondary: #4b5563;     /* gray-600 */
  --text-muted: #9ca3af;         /* gray-400 */
  
  /* Borders */
  --border-soft: #e5e7eb;        /* gray-200 */
  --border-subtle: rgba(0, 0, 0, 0.05);
  
  /* Shadows */
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --shadow-card-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
}
```

### Phase 2: AdminShell → Light sidebar
- Sidebar: `bg-white` with right border/shadow (like Hafaloha)
- Campaign blue for branding in header area only
- Active nav: campaign-blue bg with white text
- Inactive: gray-600 text, hover gray-100 bg
- Mobile top bar: white bg

### Phase 3: Standardize ALL page layouts
Every admin page MUST use this wrapper:
```tsx
<div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
```
Some pages may use `max-w-6xl` or `max-w-5xl` for narrower content, but ALL need padding + centering.

Pages to fix:
- VettingPage — add padding wrapper
- DuplicatesPage — add padding wrapper
- EmailPage — add padding wrapper
- SmsPage — add padding wrapper
- ImportPage — add padding wrapper
- EventsPage — standardize
- LeaderboardPage — standardize
- PollWatcherPage — standardize
- QRCodePage — standardize
- ScanFormPage — standardize
- WarRoomPage — bring into same design system (white cards, gray bg)
- PrecinctSettingsPage — match QuotaSettingsPage width pattern
- StaffEntryPage — standardize

### Phase 4: Fix individual page issues
- Email page styling
- War Room — use same card system as other pages
- Table styling consistency
- Status badges consistency (light theme colors)
- Fix any hardcoded dark colors (bg-[#...] references)

### Phase 5: Fix status badge colors for light theme
Dark theme badges like `bg-green-100 text-emerald-300` need to become proper light theme: `bg-green-100 text-green-800` etc.

## Files to modify
1. `web/src/index.css` — flip to light theme
2. `web/src/components/AdminShell.tsx` — light sidebar
3. `web/src/components/AdminLayout.tsx` — light loading states
4. `web/src/components/DashboardSkeleton.tsx` — light skeleton
5. `web/src/App.tsx` — light loading states
6. ALL 22 admin page files — standardize wrappers + fix colors

## Reference Apps
- Hafaloha V2: `~/work/Hafaloha/web/src/layouts/AdminLayout.tsx`
- Three Squares: `~/work/three-squares-pos/`

## Key Rules
- NO emojis in UI — SVGs/lucide-react only
- Campaign blue (#1B3A6B) for primary actions + active nav
- Campaign red (#C41E3A) for danger/destructive only
- Use `app-card`, `app-input`, `app-select`, `app-btn-*` classes consistently
- Consistent `p-4 sm:p-6 lg:p-8` padding on all pages
- All text colors via CSS variables, no hardcoded grays
