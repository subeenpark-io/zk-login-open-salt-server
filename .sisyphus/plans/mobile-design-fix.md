# Mobile Design Fix for zkLogin Wallet dApp

## TL;DR

> **Quick Summary**: Fix mobile responsiveness issues on Landing Page and Dashboard for iPhone 16 and similar devices. Focus on readable text, truncated hashes, proper spacing, and adequate touch targets.
> 
> **Deliverables**:
> - Fixed Landing Page with responsive typography and spacing
> - Fixed Dashboard with mobile-optimized cards and actions
> - Truncated transaction hashes (8...8 format)
> - Improved touch targets (min 44px height)
> 
> **Estimated Effort**: Short (2-3 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 6

---

## Context

### Original Request
User reported mobile design issues when viewing the site on iPhone 16:
- Elements overflow/cut off
- Transaction hashes unreadable
- Poor spacing/layout
- Buttons too small to tap

### Interview Summary
**Key Discussions**:
- Pages affected: Landing Page (login) and Dashboard (wallet)
- No new dependencies or components needed
- TailwindCSS responsive classes approach

**Research Findings**:
- Current code only uses `md:` breakpoint (768px)
- iPhone 16 viewport: 393px (below even `sm:` at 640px)
- Transaction digests show full 64-char hash without truncation
- Button padding `py-2` (~8px) is below Apple's 44px minimum touch target

### Metis Review
**Identified Gaps** (addressed):
- Minimum viewport spec: Applied 375px default (supports iPhone SE too)
- Transaction truncation format: Applied `first8...last8` standard format
- Safe area insets: Marked as out of scope (future enhancement)
- Desktop layout: Guardrail added to not modify `md:` and above

---

## Work Objectives

### Core Objective
Make the zkLogin Wallet dApp mobile-responsive for viewports down to 375px width, focusing on Landing Page and Dashboard.

### Concrete Deliverables
- `demo_wallet/src/pages/LandingPage.tsx` - Responsive typography and spacing
- `demo_wallet/src/pages/DashboardPage.tsx` - Mobile-optimized layout
- `demo_wallet/src/components/wallet/TransactionHistory.tsx` - Truncated digests
- `demo_wallet/src/components/wallet/WalletAddress.tsx` - Better address display
- `demo_wallet/src/components/ui/Button.tsx` - 44px minimum touch target

### Definition of Done
- [ ] No horizontal scroll at 375px viewport width
- [ ] All text readable without zooming on iPhone 16
- [ ] Transaction digests display as `0x{first8}...{last8}` format
- [ ] All interactive buttons have minimum 44px touch target
- [ ] Desktop layout (768px+) unchanged

### Must Have
- Responsive text sizing for headings (`text-3xl sm:text-4xl md:text-5xl`)
- Truncated transaction hashes with `...` ellipsis
- Stacked Quick Actions on smallest screens (`grid-cols-1 sm:grid-cols-2`)
- Minimum 44px button height

### Must NOT Have (Guardrails)
- No new npm dependencies
- No new components (modify existing only)
- No changes to `md:` and larger breakpoint styles
- No color, font, or design token changes
- No CSS-in-JS or inline styles (Tailwind only)
- No animations or transitions added
- No safe area inset handling (future scope)
- No tablet-specific (`sm:`) breakpoints unless necessary for mobile fix

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no Playwright tests currently)
- **User wants tests**: Manual-only (DevTools verification)
- **Framework**: None (manual Chrome DevTools verification)

### Manual Verification Procedure

Each TODO includes verification steps using Chrome DevTools:

**Setup:**
1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Toggle Device Toolbar (Cmd+Shift+M)
3. Select "iPhone 14 Pro" or set custom viewport: 393 x 852

**Verification Pattern:**
```
1. Navigate to page
2. Scroll through content
3. Verify: No horizontal scrollbar appears
4. Verify: All text readable, no cut-off
5. Verify: Buttons visually large enough for touch
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Fix LandingPage.tsx responsive layout
├── Task 3: Fix TransactionHistory.tsx digest truncation
├── Task 4: Fix WalletAddress.tsx mobile display
└── Task 5: Fix Button.tsx touch target size

Wave 2 (After Wave 1):
├── Task 2: Fix DashboardPage.tsx layout (depends on Button fix)
└── Task 6: Full mobile verification (depends on all)

Critical Path: Tasks 1,3,4,5 → Task 2 → Task 6
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 6 | 3, 4, 5 |
| 2 | 5 (Button) | 6 | None |
| 3 | None | 6 | 1, 4, 5 |
| 4 | None | 6 | 1, 3, 5 |
| 5 | None | 2, 6 | 1, 3, 4 |
| 6 | 1, 2, 3, 4, 5 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 3, 4, 5 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"], run_in_background=true) |
| 2 | 2, 6 | dispatch after Wave 1 completes |

---

## TODOs

- [ ] 1. Fix LandingPage responsive typography and layout

  **What to do**:
  - Add responsive text sizing to main heading: `text-3xl sm:text-4xl md:text-5xl`
  - Reduce subtitle text on mobile: `text-lg sm:text-xl`
  - Adjust container padding for mobile: `px-4 sm:px-6`
  - Ensure feature grid stacks properly: verify `grid-cols-1 md:grid-cols-3` works
  - Reduce emoji size on mobile if needed: `text-3xl sm:text-4xl`

  **Must NOT do**:
  - Do not change colors or design tokens
  - Do not modify `md:` breakpoint values (only add smaller breakpoints)
  - Do not add new sections or content

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend UI styling task requiring responsive design knowledge
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Mobile-first responsive design expertise
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for implementation, only for verification

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4, 5)
  - **Blocks**: Task 6 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `demo_wallet/src/pages/LandingPage.tsx:22-64` - Current Landing Page structure, all responsive changes go here
  - `demo_wallet/tailwind.config.js:7-15` - Custom colors `sui-blue` and `sui-dark` to preserve

  **Type References**:
  - None needed (pure styling changes)

  **Documentation References**:
  - TailwindCSS Responsive Design: https://tailwindcss.com/docs/responsive-design
  - Default breakpoints: `sm:640px`, `md:768px`, `lg:1024px`

  **WHY Each Reference Matters**:
  - `LandingPage.tsx:25` - Contains the `text-5xl` that needs `text-3xl sm:text-4xl md:text-5xl`
  - `LandingPage.tsx:34` - Feature grid uses `md:grid-cols-3`, verify mobile stack works
  - `tailwind.config.js` - Ensure no custom breakpoints that would conflict

  **Acceptance Criteria**:

  **Automated Verification (Chrome DevTools):**
  ```
  # Agent executes via browser automation or manual DevTools:
  1. Open: http://localhost:5173
  2. DevTools → Device Toolbar → iPhone 14 Pro (393x852)
  3. Assert: H1 "zkLogin Wallet" fully visible, no horizontal scroll
  4. Assert: Subtitle text readable (not cut off)
  5. Assert: 3 feature cards stack vertically on mobile
  6. Assert: "Login with Google" button centered and tappable
  7. Resize to 768px width
  8. Assert: Layout unchanged from current desktop view
  ```

  **Evidence to Capture:**
  - [ ] Screenshot at 393px viewport showing stacked layout
  - [ ] Screenshot at 768px viewport showing unchanged desktop layout

  **Commit**: YES (group with Task 3, 4, 5 if all Wave 1 done)
  - Message: `fix(demo_wallet): improve mobile responsive layout`
  - Files: `demo_wallet/src/pages/LandingPage.tsx`
  - Pre-commit: `cd demo_wallet && npm run build`

---

- [ ] 2. Fix DashboardPage mobile layout and spacing

  **What to do**:
  - Adjust header padding for mobile: verify `px-4` sufficient
  - Make Quick Actions stack on very small screens: `grid-cols-1 xs:grid-cols-2` or responsive alternative
  - Ensure cards have proper mobile margins
  - Verify success message banner doesn't overflow
  - Ensure "My Wallet" heading is responsive: `text-2xl sm:text-3xl`

  **Must NOT do**:
  - Do not change any business logic
  - Do not modify transaction history (separate task)
  - Do not add new sections

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dashboard layout responsive styling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Mobile-first responsive design
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for implementation

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6 (final verification)
  - **Blocked By**: Task 5 (Button touch target must be fixed first)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `demo_wallet/src/pages/DashboardPage.tsx:30-136` - Full Dashboard component
  - `demo_wallet/src/pages/DashboardPage.tsx:77` - Card grid using `md:grid-cols-2`
  - `demo_wallet/src/pages/DashboardPage.tsx:85` - Quick Actions `grid-cols-2`
  - `demo_wallet/src/components/ui/Card.tsx:14` - Card styling pattern

  **WHY Each Reference Matters**:
  - `:77` - Address/Balance cards may need stacking on mobile
  - `:85` - Quick Actions `grid-cols-2` can be cramped at 375px, may need `grid-cols-1 min-[400px]:grid-cols-2`
  - `Card.tsx` - Padding `p-6` might be too much on mobile (consider `p-4 sm:p-6`)

  **Acceptance Criteria**:

  **Automated Verification (Chrome DevTools):**
  ```
  # Agent executes:
  1. Navigate to: http://localhost:5173/wallet (requires auth mock or manual login)
  2. DevTools → Device Toolbar → iPhone 14 Pro (393x852)
  3. Assert: Header "zkLogin Wallet" and "Logout" both visible
  4. Assert: Address and Balance cards stack vertically or fit side-by-side without overflow
  5. Assert: Quick Actions buttons are tappable (visually adequate size)
  6. Assert: No horizontal scroll anywhere
  7. Assert: Info note at bottom readable, link tappable
  ```

  **Evidence to Capture:**
  - [ ] Screenshot of Dashboard at 393px showing card layout
  - [ ] Screenshot of Quick Actions section

  **Commit**: NO (groups with Task 6)
  - Message: N/A (will be in final commit)
  - Files: `demo_wallet/src/pages/DashboardPage.tsx`

---

- [ ] 3. Fix TransactionHistory digest truncation

  **What to do**:
  - Truncate transaction digest to `{first8}...{last8}` format
  - Example: `0x1a2b3c4d...e5f6g7h8`
  - Create helper function or inline truncation
  - Ensure truncated digest is still clickable/tappable
  - Add `title` attribute with full digest for hover tooltip

  **Must NOT do**:
  - Do not change the transaction data structure
  - Do not add loading states
  - Do not create new components

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, focused string formatting change
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI text formatting patterns
  - **Skills Evaluated but Omitted**:
    - None needed for this simple task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4, 5)
  - **Blocks**: Task 6 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `demo_wallet/src/components/wallet/TransactionHistory.tsx:94-105` - Transaction row rendering
  - `demo_wallet/src/components/wallet/TransactionHistory.tsx:99-101` - Current digest display (FULL digest)

  **WHY Each Reference Matters**:
  - `:99-101` - This is the exact location showing `{tx.digest}` that needs truncation
  - The link structure must be preserved, only the displayed text changes

  **Current Code (line 99-101):**
  ```tsx
  <a href={explorerUrl(tx.digest)} ...>
    {tx.digest}  // <-- CHANGE THIS to truncated format
  </a>
  ```

  **Target Code:**
  ```tsx
  <a href={explorerUrl(tx.digest)} title={tx.digest} ...>
    {tx.digest.slice(0, 10)}...{tx.digest.slice(-8)}
  </a>
  ```

  **Acceptance Criteria**:

  **Automated Verification (Chrome DevTools):**
  ```
  # Agent executes:
  1. Navigate to: http://localhost:5173/wallet (with transaction history)
  2. DevTools → Device Toolbar → iPhone 14 Pro (393x852)
  3. Assert: Transaction digests display as truncated format
  4. Assert: Format matches pattern: 0x{8chars}...{8chars}
  5. Assert: Hover over digest shows full digest in tooltip
  6. Assert: Click on digest opens correct explorer URL (full digest in URL)
  ```

  **Regex Validation:**
  - Displayed text should match: `/^0x[a-f0-9]{8}\.{3}[a-f0-9]{8}$/i`

  **Evidence to Capture:**
  - [ ] Screenshot showing truncated digests on mobile
  - [ ] Verify hover tooltip shows full digest

  **Commit**: YES (group with Tasks 1, 4, 5)
  - Message: `fix(demo_wallet): truncate transaction digests for mobile`
  - Files: `demo_wallet/src/components/wallet/TransactionHistory.tsx`
  - Pre-commit: `cd demo_wallet && npm run build`

---

- [ ] 4. Fix WalletAddress mobile display

  **What to do**:
  - Ensure address wraps properly on mobile (already has `break-all`)
  - Make copy button always accessible (not pushed off screen)
  - Consider stacking layout on very narrow screens: `flex-col sm:flex-row`
  - Ensure button doesn't shrink too small

  **Must NOT do**:
  - Do not truncate the address (user wants full address visible)
  - Do not change copy functionality
  - Do not add new visual elements

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single component, simple flex layout adjustment
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Responsive flex layout patterns
  - **Skills Evaluated but Omitted**:
    - None needed for simple layout fix

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 5)
  - **Blocks**: Task 6 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `demo_wallet/src/components/wallet/WalletAddress.tsx:22-54` - Full component
  - `demo_wallet/src/components/wallet/WalletAddress.tsx:24-30` - Flex layout with address
  - `demo_wallet/src/components/wallet/WalletAddress.tsx:31-51` - Copy button

  **WHY Each Reference Matters**:
  - `:24` - Current `flex items-center justify-between` may cause button to be pushed off
  - `:27-28` - Address has `break-all` but within constrained flex item
  - `:34` - Button has `ml-4 shrink-0` which prevents shrinking but may cause overflow

  **Potential Fix:**
  ```tsx
  // Change from:
  <div className="flex items-center justify-between">
  // To:
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  ```

  **Acceptance Criteria**:

  **Automated Verification (Chrome DevTools):**
  ```
  # Agent executes:
  1. Navigate to: http://localhost:5173/wallet
  2. DevTools → Device Toolbar → iPhone 14 Pro (393x852)
  3. Assert: Full wallet address visible (with wrapping)
  4. Assert: Copy button visible and accessible (not cut off)
  5. Assert: Copy button tappable (adequate touch target)
  6. Click Copy button
  7. Assert: "Copied!" feedback appears
  ```

  **Evidence to Capture:**
  - [ ] Screenshot showing address card with visible copy button on mobile

  **Commit**: YES (group with Tasks 1, 3, 5)
  - Message: `fix(demo_wallet): improve wallet address mobile layout`
  - Files: `demo_wallet/src/components/wallet/WalletAddress.tsx`
  - Pre-commit: `cd demo_wallet && npm run build`

---

- [ ] 5. Fix Button touch target size

  **What to do**:
  - Add minimum height to Button component: `min-h-[44px]`
  - Ensure touch target meets Apple's 44x44px guideline
  - Verify padding is comfortable for mobile: `py-2.5` or `py-3`
  - Test both primary and secondary variants

  **Must NOT do**:
  - Do not change button colors
  - Do not change font sizes
  - Do not add new variants
  - Do not break desktop appearance

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single component, simple CSS addition
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Touch target accessibility standards
  - **Skills Evaluated but Omitted**:
    - None needed for simple styling fix

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 2 (Dashboard uses buttons), Task 6
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `demo_wallet/src/components/ui/Button.tsx:18-30` - Full Button component
  - `demo_wallet/src/components/ui/Button.tsx:21` - Current padding: `px-4 py-2`

  **External References**:
  - Apple HIG Touch Targets: https://developer.apple.com/design/human-interface-guidelines/accessibility#Touch-targets
  - Minimum recommended: 44x44 points

  **WHY Each Reference Matters**:
  - `:21` - Current `py-2` is only 8px (0.5rem), need at least `py-2.5` (10px) or add `min-h-[44px]`
  - Button is used across all pages, so this fix propagates everywhere

  **Target Change:**
  ```tsx
  // Add min-h-[44px] to base classes
  'min-h-[44px] px-4 py-2 rounded-lg font-medium ...'
  ```

  **Acceptance Criteria**:

  **Automated Verification (Chrome DevTools):**
  ```
  # Agent executes:
  1. Navigate to: http://localhost:5173
  2. DevTools → Inspect "Login with Google" button
  3. Assert: Computed height >= 44px
  4. Navigate to: http://localhost:5173/wallet
  5. Inspect "Send SUI" and "Copy Address" buttons
  6. Assert: Both buttons have computed height >= 44px
  7. Test tapping buttons in device emulation mode
  8. Assert: Buttons respond to touch without precision required
  ```

  **Evidence to Capture:**
  - [ ] DevTools computed style showing min-height >= 44px
  - [ ] Screenshot of buttons on mobile showing adequate size

  **Commit**: YES (group with Tasks 1, 3, 4)
  - Message: `fix(demo_wallet): increase button touch target to 44px`
  - Files: `demo_wallet/src/components/ui/Button.tsx`
  - Pre-commit: `cd demo_wallet && npm run build`

---

- [ ] 6. Final mobile verification across all pages

  **What to do**:
  - Verify all previous tasks' acceptance criteria
  - Test complete user flow on mobile viewport
  - Check for any regressions on desktop
  - Document any remaining issues for future work

  **Must NOT do**:
  - Do not make additional code changes (verification only)
  - Do not scope creep into new features

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Comprehensive UI verification task
  - **Skills**: [`frontend-ui-ux`, `playwright`]
    - `frontend-ui-ux`: Visual inspection expertise
    - `playwright`: Browser automation for verification
  - **Skills Evaluated but Omitted**:
    - None

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (final)
  - **Blocks**: None (this is final task)
  - **Blocked By**: Tasks 1, 2, 3, 4, 5 (all previous work)

  **References**:
  - All files modified in Tasks 1-5
  - `demo_wallet/src/pages/LandingPage.tsx`
  - `demo_wallet/src/pages/DashboardPage.tsx`
  - `demo_wallet/src/components/wallet/TransactionHistory.tsx`
  - `demo_wallet/src/components/wallet/WalletAddress.tsx`
  - `demo_wallet/src/components/ui/Button.tsx`

  **Acceptance Criteria**:

  **Mobile Verification (393px viewport):**
  ```
  # Complete user flow verification:
  
  1. LANDING PAGE
     - [ ] Open http://localhost:5173 at 393x852
     - [ ] H1 "zkLogin Wallet" readable, not cut off
     - [ ] Subtitle readable
     - [ ] Login button centered, tap target adequate
     - [ ] Feature cards stack vertically
     - [ ] No horizontal scroll
  
  2. DASHBOARD (after login)
     - [ ] Header shows title and logout button
     - [ ] Address card shows full address with wrapping
     - [ ] Copy button accessible and works
     - [ ] Balance card readable
     - [ ] Quick Actions buttons have adequate touch targets
     - [ ] Transaction digests truncated to 8...8 format
     - [ ] Transaction links work (open explorer)
     - [ ] Info note at bottom readable
     - [ ] No horizontal scroll
  
  3. SEND MODAL
     - [ ] Open Send SUI modal
     - [ ] Inputs visible and usable
     - [ ] Buttons have adequate touch targets
     - [ ] Modal doesn't overflow screen
  
  4. DESKTOP REGRESSION (768px+)
     - [ ] Landing page unchanged from before
     - [ ] Dashboard unchanged from before
     - [ ] No visual regressions
  ```

  **Evidence to Capture:**
  - [ ] Screenshot: Landing page mobile
  - [ ] Screenshot: Dashboard mobile
  - [ ] Screenshot: Send modal mobile
  - [ ] Screenshot: Landing page desktop (regression check)
  - [ ] Screenshot: Dashboard desktop (regression check)

  **Commit**: YES (final commit)
  - Message: `fix(demo_wallet): mobile responsive design improvements

    - Responsive typography on Landing Page
    - Truncated transaction digests (8...8 format)
    - Improved button touch targets (44px min)
    - Better mobile layout for WalletAddress
    - Stacked Quick Actions on narrow screens`
  - Files: All modified files from Tasks 1-5
  - Pre-commit: `cd demo_wallet && npm run build`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1, 3, 4, 5 (Wave 1) | `fix(demo_wallet): mobile responsive design - wave 1` | LandingPage.tsx, TransactionHistory.tsx, WalletAddress.tsx, Button.tsx | `npm run build` |
| 2, 6 (Wave 2) | `fix(demo_wallet): mobile responsive design - complete` | DashboardPage.tsx | Full manual verification |

**Alternative: Single Commit** (if preferred)
- After Task 6: `fix(demo_wallet): improve mobile responsive design`
- Include all files with detailed message

---

## Success Criteria

### Verification Commands
```bash
# Build verification
cd demo_wallet && npm run build

# Start dev server for manual testing
cd demo_wallet && npm run dev
```

### Final Checklist
- [ ] No horizontal scroll at 375px viewport width
- [ ] No horizontal scroll at 393px viewport width (iPhone 16)
- [ ] All text readable without zooming
- [ ] Transaction digests truncated to 8...8 format
- [ ] All buttons have minimum 44px touch target
- [ ] Desktop layout (768px+) unchanged
- [ ] All "Must NOT Have" guardrails respected
- [ ] Build passes without errors
