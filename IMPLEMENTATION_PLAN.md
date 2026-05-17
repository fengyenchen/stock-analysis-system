# Implementation Plan — PR #10 Selective Merge Strategy

## Background

This plan derives from a code review of PR #10
(`feat(frontend): 整合首頁優化、訪客模式與效能修復`). That PR was authored by
pollop123 and bundles four unrelated concerns that have very different readiness
levels. Rather than merging or rejecting it wholesale, we are cherry-picking the
good ideas and reworking the problematic ones into separate, focused tasks.

---

## Codebase Overview

| Layer | Tech | Key paths |
|---|---|---|
| Backend API | FastAPI + SQLAlchemy + Alembic | `app/routers/`, `app/models.py`, `app/schemas.py`, `app/security.py` |
| Database | SQLite (dev) / PostgreSQL (prod via Neon) | `alembic/versions/` for migrations |
| Frontend | React 18 + TypeScript + Vite + TanStack Query | `frontend/src/` |
| Auth | JWT (access + refresh) — blacklist pattern | `app/routers/auth.py`, `app/security.py` |
| API prefix | All API endpoints live under `/api/v1/` | `app/main.py` |
| Frontend API client | Axios, base URL ends with a trailing slash | `frontend/src/api/client.ts` |

### Current API endpoints (relevant ones)

```
POST   /api/v1/users                     # register
POST   /api/v1/sessions                  # login
DELETE /api/v1/sessions/current          # logout
POST   /api/v1/token-refreshes           # refresh token
GET    /api/v1/users/me                  # profile
GET    /api/v1/stocks                    # list/search (auth required)
GET    /api/v1/stocks/{symbol}           # stock detail (auth required)
GET    /api/v1/stocks/{symbol}/quotes/latest
GET    /api/v1/stocks/{symbol}/prices
GET    /api/v1/stocks/{symbol}/sync-status
POST   /api/v1/stock-sync-jobs          # trigger historical sync
GET    /api/v1/watchlists               # list watchlists (auth required)
...
```

### Frontend key files

```
frontend/src/
  App.tsx                    # route definitions
  api/
    client.ts                # axios instance, token refresh interceptor
    auth.ts                  # login, register, logout, getMe
    stocks.ts                # all stock API calls
    watchlists.ts            # all watchlist API calls
  components/
    Navbar.tsx
    ProtectedRoute.tsx
  pages/
    DashboardPage.tsx
    StockSearchPage.tsx
    StockDetailPage.tsx
    LoginPage.tsx
    RegisterPage.tsx
    WatchlistsPage.tsx
    WatchlistDetailPage.tsx
  stores/
    authStore.ts             # Zustand store: user, tokens, isAuthenticated
  types/
    index.ts                 # shared TypeScript interfaces
```

### What PR #10 introduced (summary)

Good ideas:
- Guest mode routing (public access to Dashboard, Stocks, Stock Detail)
- Investment disclaimer banner in Navbar
- Conditional Login/Logout in Navbar based on auth state
- TypeScript fixes: `err: any` → `err: unknown`
- API URL normalization: removed leading `/` from all `api/*.ts` calls (consistent with client.ts trailing-slash base)
- Forgot/Reset password UI pages
- `order_by(Stock.symbol)` on list endpoint

Problematic changes that must NOT be merged as-is:
- **Mock price data** used in DashboardPage watchlist cards (`getMockPriceData`)
- **Mock change %** used in StockSearchPage gainers/losers filter (`getMockChange`)
- **Mock chart history** shown when DB has no data (`generateMockHistory`)
- **Fake "AI 交易洞察"** panel with hardcoded Chinese trading advice
- **Hardcoded heatmap** with `MOCK_INDUSTRIES` (static percentages)
- **Limit raised to 3000** in backend without performance justification
- **Fetching 3000 stocks** on every StockSearchPage mount
- **Date range picker removed** from StockDetailPage (feature regression)
- **Auto-sync `useEffect` removed** from StockDetailPage (replaced by silent mock)
- **`onError` callbacks removed** from sync and watchlist-add mutations
- **`package-lock.json` noise** (libc fields removed, caused by different dev machine)

---

## Task List

Tasks are designed to be independent — each can be worked on separately and merged
via its own PR. Complete in order within each track; tracks A and B can run in
parallel, track C depends on track A.

---

### task-1 — Backend quick fixes ✅ DONE

**Scope:** Two small backend changes that are safe to merge immediately.

**Files to change:**
- `app/routers/stocks.py`

**Changes:**

1. Add `order_by(Stock.symbol)` to `list_stocks` so pagination is deterministic:
   ```python
   stocks = query.order_by(Stock.symbol).offset(offset).limit(limit).all()
   ```

2. Keep `le=500` on the `limit` parameter (do NOT raise it to 3000). The
   frontend does not need 3000 rows — that change was driven by a client-side
   filtering approach that we are rejecting.

**Do NOT touch:**
- Authentication requirements on any endpoint
- Any other router files
- Schemas or models

**Acceptance criteria:**
- `GET /api/v1/stocks` returns stocks sorted alphabetically by symbol
- Maximum allowed `limit` remains 500
- All existing tests in `tests/test_stocks.py` still pass

---

### task-2 — Frontend code quality ✅ DONE

**Scope:** TypeScript fixes and API URL normalization. Zero visual changes.

**Files to change:**
- `frontend/src/api/client.ts`
- `frontend/src/api/auth.ts`
- `frontend/src/api/stocks.ts`
- `frontend/src/api/watchlists.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/WatchlistDetailPage.tsx`
- `frontend/src/types/index.ts` (add new types needed by task-5)

**Changes:**

1. **`client.ts`** — ensure the resolved base URL ends with a trailing slash:
   ```ts
   return base.endsWith("/") ? base : `${base}/`;
   ```
   This is already correct in the current branch; verify it is in `main` too.

2. **`api/auth.ts`, `api/stocks.ts`, `api/watchlists.ts`** — remove the leading
   `/` from every path string passed to `apiClient` (e.g., `"/stocks"` → `"stocks"`).
   With a trailing-slash base URL, a leading slash causes double-slash paths.
   Apply this consistently across all three files.

3. **TypeScript: eliminate `err: any`** in LoginPage, RegisterPage,
   WatchlistDetailPage. Pattern to follow:
   ```ts
   } catch (err: unknown) {
     const msg = (err as { response?: { data?: { detail?: string } } })
       .response?.data?.detail || "Fallback message";
   ```
   Extract the cast into a small shared utility rather than repeating it:
   ```ts
   // frontend/src/api/client.ts  (add at bottom)
   export function getApiErrorMessage(err: unknown, fallback: string): string {
     return (
       (err as { response?: { data?: { detail?: string } } })
         ?.response?.data?.detail ?? fallback
     );
   }
   ```
   Then import and use `getApiErrorMessage` in all catch blocks.

4. **`types/index.ts`** — add the two types needed for the password reset flow
   (task-5 depends on this):
   ```ts
   export interface PasswordResetRequest { email: string; }
   export interface PasswordResetConfirmRequest { token: string; new_password: string; }
   ```

**Do NOT touch:**
- Any JSX / visual markup
- Routing
- Backend files

**Acceptance criteria:**
- `npx tsc --noEmit` in `frontend/` passes with zero errors
- No `err: any` remains in the changed files
- All API calls use paths without a leading `/`

---

### task-3 — Guest mode routing + Navbar ✅ DONE

**Scope:** Make Dashboard, Stocks, and Stock Detail pages publicly accessible
without login. Add conditional Login/Logout in Navbar and the investment
disclaimer banner.

**Files to change:**
- `frontend/src/App.tsx`
- `frontend/src/components/Navbar.tsx`

**Changes:**

**`App.tsx`** — reorganise routes into two groups:

```tsx
{/* Public routes — no auth required */}
<Route element={<Layout />}>
  <Route path="/" element={<DashboardPage />} />
  <Route path="/stocks" element={<StockSearchPage />} />
  <Route path="/stocks/:symbol" element={<StockDetailPage />} />
</Route>

{/* Auth routes — no layout */}
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />

{/* Protected routes */}
<Route element={<ProtectedRoute />}>
  <Route element={<Layout />}>
    <Route path="/watchlists" element={<WatchlistsPage />} />
    <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
  </Route>
</Route>

<Route path="*" element={<Navigate to="/" replace />} />
```

**`Navbar.tsx`** — two changes:

1. Add the investment disclaimer banner above the `<nav>` tag:
   ```tsx
   <div className="bg-card border-b border-border py-1.5 px-4 text-center">
     <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
       <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
       本網站內容僅供參考，不構成任何投資建議。投資人應審慎評估並自負風險。
     </p>
   </div>
   ```

2. Replace the always-visible logout button with a conditional:
   - If `user` is truthy: show username + Logout button (redirects to `/` on success)
   - If `user` is falsy: show a "Login" link to `/login`

**Do NOT touch:**
- DashboardPage, StockSearchPage, StockDetailPage content
- Backend files
- Mock data (handled in tasks 6–8)

**Acceptance criteria:**
- Visiting `/`, `/stocks`, `/stocks/2330` without a JWT cookie works (no redirect to login)
- Visiting `/watchlists` without JWT redirects to `/login`
- Navbar shows Login button for unauthenticated users, username + Logout for authenticated
- Disclaimer banner appears on all pages

---

### task-4 — Backend: password reset endpoints ✅ DONE

**Scope:** Add the two endpoints required by the Forgot/Reset password UI pages.
The UI (task-5) cannot be merged before this task is complete and deployed.

**Files to create/change:**
- `app/models.py` — add `PasswordResetToken` model
- `app/schemas.py` — add request/response schemas
- `app/routers/auth.py` — add two new routes
- `app/main.py` — nothing to change (auth router already included)
- `alembic/versions/` — new migration file (generate with `alembic revision --autogenerate`)

**New DB model (`app/models.py`):**

```python
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)  # SHA-256 hex
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
```

**New schemas (`app/schemas.py`):**

```python
class PasswordResetRequestCreate(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        # same regex checks as UserCreate.password_complexity
        ...
        return v
```

**New routes (`app/routers/auth.py`):**

```
POST /api/v1/password-reset-requests
  Body: { email }
  Behaviour:
    - Look up user by email. If not found, return 200 anyway (avoid user enumeration).
    - Generate a cryptographically random token (secrets.token_urlsafe(32)).
    - Store SHA-256 hash of the token in PasswordResetToken with expires_at = now + 1 hour.
    - In production, send email with reset link. For now, log the plain token to stdout
      (so it can be tested without an email provider).
    - Return HTTP 200 { "detail": "If that email is registered, a reset link has been sent." }

POST /api/v1/password-resets
  Body: { token, new_password }
  Behaviour:
    - Hash the incoming token and look up PasswordResetToken.
    - If not found, expired (expires_at < now), or already used: return 400.
    - Validate new_password complexity (reuse the validator).
    - Set user.hashed_password = get_password_hash(new_password).
    - Set token.used_at = now.
    - Commit.
    - Return HTTP 200 { "detail": "Password updated." }
```

**Security requirements:**
- Store only the hash of the token (never the plaintext)
- Token lifetime: 1 hour
- Tokens are single-use (mark `used_at` on consumption)
- Rate limiting: not required in this task (can be added later via middleware)
- Do NOT send real email in this task — log to stdout with a TODO comment

**Acceptance criteria:**
- `POST /api/v1/password-reset-requests` with an existing email returns 200
- `POST /api/v1/password-reset-requests` with a non-existent email also returns 200 (no enumeration)
- `POST /api/v1/password-resets` with a valid token updates the password
- `POST /api/v1/password-resets` with an expired token returns 400
- `POST /api/v1/password-resets` with a used token returns 400
- New tests in `tests/test_auth.py` cover all cases above
- Alembic migration runs cleanly: `alembic upgrade head`

---

### task-5 — Frontend: password reset pages

**Scope:** Add Forgot Password and Reset Password pages to the frontend. Depends
on task-2 (types) and task-4 (backend endpoints must exist).

**Files to create/change:**
- `frontend/src/pages/ForgotPasswordPage.tsx` (new)
- `frontend/src/pages/ResetPasswordPage.tsx` (new)
- `frontend/src/api/auth.ts` — add two new functions
- `frontend/src/App.tsx` — add two new routes (build on task-3)
- `frontend/src/pages/LoginPage.tsx` — add "Forgot password?" link

**`frontend/src/api/auth.ts` additions:**

```ts
import type { PasswordResetRequest, PasswordResetConfirmRequest } from "@/types";

export async function requestPasswordReset(data: PasswordResetRequest): Promise<void> {
  await apiClient.post("password-reset-requests", data);
}

export async function resetPassword(data: PasswordResetConfirmRequest): Promise<void> {
  await apiClient.post("password-resets", data);
}
```

**`ForgotPasswordPage.tsx`** — form with a single email field:
- On submit: call `requestPasswordReset`. Always show success message (mirror backend's
  no-enumeration behaviour): "If an account exists for that email, a reset link has been sent."
- Uses `getApiErrorMessage` from task-2 for network error handling.

**`ResetPasswordPage.tsx`** — form with new password + confirm password:
- Reads `token` from `?token=` query param using `useSearchParams`.
- If no token present: show error with link back to `/forgot-password`.
- On submit: call `resetPassword({ token, new_password: password })`.
- On success: `toast.success` + navigate to `/login`.
- Client-side password validation must match backend rules (8+ chars, upper, lower, digit, special).
- Uses `getApiErrorMessage` for API errors.

**`App.tsx`** routes to add (public, no auth required, outside Layout):
```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

**`LoginPage.tsx`** — add "Forgot password?" link next to the Password label.

**Do NOT:**
- Add lazy loading for these two pages (keep it simple unless existing pattern already does it)
- Change any existing auth flow

**Acceptance criteria:**
- Visiting `/forgot-password` shows the form without login
- Submitting shows the success message regardless of whether email exists
- Visiting `/reset-password?token=abc123` shows the new password form
- Visiting `/reset-password` (no token) shows the error state with a link back
- Successful reset navigates to `/login`

---

### task-6 — DashboardPage redesign (no mock data)

**Scope:** Redesign the homepage with the improved layout from PR #10 but
without any fake/mock data. Depends on task-3 (guest mode routing).

**Files to change:**
- `frontend/src/pages/DashboardPage.tsx`

**What to keep from PR #10:**
- Two-column layout (watchlist panel + right panel)
- Watchlist selector dropdown (uses real API data)
- Search bar for unauthenticated / empty watchlist state
- Investment heatmap section structure

**What to NOT include (mock data items to remove or replace):**

| PR #10 element | Action |
|---|---|
| `getMockPriceData` function | Remove entirely |
| Price/change data shown on watchlist stock cards | Show only symbol + name; no fake prices. Add a "View →" link. |
| "AI 交易洞察" panel with hardcoded Chinese advice | Remove entirely. Replace with a simple "Quick Links" panel: links to Stocks, Watchlists, documentation. |
| `MOCK_INDUSTRIES` heatmap with hardcoded percentages | Replace with static display that clearly says "Market sector data coming soon" or remove the heatmap section. Do not show fake percentages. |

**Watchlist panel behaviour:**
- If unauthenticated: show the hero search bar ("探索台股，從這裡開始") — this is fine and useful.
- If authenticated + watchlist is empty: show same hero search bar.
- If authenticated + watchlist has items: show stock cards with symbol, name, and a link. **No price data** — prices require a live API call per stock which is expensive; that belongs in the watchlist detail page.
- The `primaryWlId` localStorage + watchlist selector is acceptable; keep it.

**`localStorage` staleness fix:**
When loading `primaryWlId` from localStorage, validate it against the fetched
watchlists array. If it doesn't exist, clear it:
```ts
useEffect(() => {
  if (watchlists && primaryWlId) {
    const still_exists = watchlists.some(wl => wl.id.toString() === primaryWlId);
    if (!still_exists) {
      setPrimaryWlId(null);
      localStorage.removeItem("primaryWatchlistId");
    }
  }
}, [watchlists, primaryWlId]);
```

**Acceptance criteria:**
- No functions named `getMockPriceData`, `MOCK_INDUSTRIES`, or similar exist in the file
- Watchlist stock cards show symbol + name + link, no prices
- Guest state shows the search bar + navigation links
- TypeScript passes with `npx tsc --noEmit`

---

### task-7 — StockSearchPage redesign

**Scope:** Improve the search page with better filtering UI and infinite scroll
but using real API data only. No mock change percentages.

**Files to change:**
- `frontend/src/pages/StockSearchPage.tsx`

**What to keep from PR #10:**
- Infinite scroll implementation with `IntersectionObserver` and sentinel ref
- Asset type filter (All / Stocks / ETFs) using the `isEtf` heuristic
- Industry quick-filter chips — keep the UI; the filter only works when `stock.industry`
  is populated, so if it returns zero results the empty state is correct
- Filter reset when search query changes
- `useLocation` to pick up `initialQuery` from navigation state (from Dashboard search)
- 4-column grid layout

**What to change:**
- **Do NOT fetch 3000 stocks.** Keep the original `listStocks(0, 50)` as the default
  browse limit. The correct fix for "show more" is the existing infinite scroll — each
  scroll trigger should call `listStocks(offset, 50)` with a growing offset, OR simply
  keep the 50-item default and note that users should use search for specific stocks.
  Simplest acceptable approach: keep `listStocks(0, 200)` with client-side slicing + infinite
  scroll to render 40 at a time. Do NOT go above `limit=200` without backend approval.
- **Remove `getMockChange`** entirely. Remove the `changePercent` field from the
  enriched stock objects. Remove the gainers/losers performance filter (it requires real
  data). Remove the red/green change badge from stock cards.
- **ETF detection fix:** The heuristic `symbol.startsWith("00") || symbol.length >= 5`
  is acceptable as an approximation; add a comment noting it is approximate.

**Revised data flow:**
```
allQuery: listStocks(0, 200)   — fetch once, cache via React Query
rawResults: searchQuery.data | allQuery.data
filteredResults: filter by assetType + selectedIndustry (no performance filter)
visibleResults: filteredResults.slice(0, visibleCount)   — rendered via infinite scroll
```

**Acceptance criteria:**
- No `getMockChange` or `changePercent` usage in the file
- No gainers/losers performance filter
- Fetched limit does not exceed 200
- Infinite scroll works: as user scrolls, more items appear without a page reload
- Industry filter chips correctly hide stocks with non-matching `stock.industry` values
- Asset type filter works
- `npx tsc --noEmit` passes

---

### task-8 — StockDetailPage refinements

**Scope:** Remove mock history, restore removed features, fix lost error handling.
Depends on task-3 (guest routing).

**Files to change:**
- `frontend/src/pages/StockDetailPage.tsx`

**Changes:**

1. **Remove `generateMockHistory`** entirely. When `historyQuery.data` is empty:
   - Show an empty chart container (the chart library renders nothing for empty data, which is fine)
   - Keep the existing "No historical data" message + "Sync historical prices" button
   - Remove the `isMocking` flag and the "Demo Data Mode" badge

2. **Restore `startDate` / `endDate` state and the date picker UI:**
   ```ts
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   ```
   Restore the two `<input type="date">` fields in the chart header. These feed
   directly into `getStockHistory(symbol, startDate || undefined, endDate || undefined)`.

3. **Restore `onError` on `syncMutation`:**
   ```ts
   onError: (err: unknown) => {
     toast.error(getApiErrorMessage(err, "Sync failed"));
   },
   ```

4. **Restore `onError` on `addItemMutation`:**
   ```ts
   onError: (err: unknown) => {
     toast.error(getApiErrorMessage(err, "Failed to add to watchlist"));
   },
   ```
   Use `getApiErrorMessage` from task-2.

5. **Auto-sync `useEffect`:** The original auto-sync on empty history was removed
   on the grounds that it caused infinite loops — but the original code had correct
   guards. Restore it:
   ```ts
   const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
   useEffect(() => {
     if (
       !autoSyncAttempted &&
       historyQuery.data?.length === 0 &&
       !historyQuery.isLoading &&
       !syncMutation.isPending &&
       !syncMutation.isSuccess
     ) {
       setAutoSyncAttempted(true);
       syncMutation.mutate();
     }
   }, [historyQuery.data, historyQuery.isLoading, autoSyncAttempted, syncMutation]);
   ```

6. **Keep the UI improvements from PR #10** that are cosmetic-only and don't involve
   mock data:
   - Larger, bolder stock symbol heading
   - TWSE/ETF badge (using the same `startsWith("00") || length >= 5` heuristic)
   - Improved "Add to Watchlist" dropdown styling
   - Chart container styling changes (transparent background, lighter grid)
   - Stat cards redesign (4-column grid with Current Price / Daily Change / Volume / Range)
   - "Back to Market" link text
   - "Sync Market Data" button label

7. **Remove `syncStatus` variable** if it becomes unused after the above changes;
   keep the sync status display in the chart footer.

**Acceptance criteria:**
- `generateMockHistory` does not exist in the file
- Date range pickers are visible and functional
- When sync fails, a toast error appears
- When add-to-watchlist fails, a toast error appears
- When a stock has no history, auto-sync is triggered once automatically
- `npx tsc --noEmit` passes

---

## Merge Order

```
task-1 (backend)  ──────────────────────────────────► merge
task-2 (TS fixes) ──────────────────────────────────► merge
task-3 (routing)  [after task-2] ────────────────────► merge
task-4 (backend password reset) ─────────────────────► merge
task-5 (frontend password reset) [after task-2, 4] ──► merge
task-6 (Dashboard) [after task-3] ───────────────────► merge
task-7 (StockSearch) [after task-2] ─────────────────► merge
task-8 (StockDetail) [after task-2, 3] ──────────────► merge
```

Tasks 1, 2, and 4 are fully independent and can be started simultaneously.

---

## What to Discard from PR #10

The following changes from PR #10 should be **explicitly excluded** from all tasks
above — do not merge them even incidentally:

- `package-lock.json` changes (libc field removals) — regenerate fresh on the
  canonical dev environment instead
- `limit: int = Query(100, ge=1, le=3000)` backend change
- All mock data functions: `getMockPriceData`, `getMockChange`, `generateMockHistory`, `MOCK_INDUSTRIES`
- "AI 交易洞察" panel (hardcoded trading advice)
- `listStocks(0, 3000)` call in StockSearchPage
- Gainers/Losers performance filter (requires real price data)
- Removal of the date range pickers from StockDetailPage
- Removal of `onError` callbacks from mutations
- Removal of the auto-sync `useEffect`
