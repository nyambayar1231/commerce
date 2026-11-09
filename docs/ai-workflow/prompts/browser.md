# Browser brief: <name>

<!-- Template for browser-tester (OpenCode + browse, the owner's Chrome). Copy to
     .ai/briefs/<name>.md. Keep it to one flow; the worker reports, it never edits code. -->

- **Role:** browser-tester
- **Allowed origins:** http://localhost:5173 <add :4000, :9000 (real Saleor), :8000 only if needed>
- **Why:** <what the lead needs to decide from this, e.g. "does the drawer match Saleor at 390px">

## Setup state
<theme, sidebar state, viewport width: e.g. "set localStorage activeMacawUITheme=defaultDark,
dashboard-sidebar-collapsed=false, reload". For a width the window cannot take, load the app in
a same-origin iframe of that width.>

## Steps
1. Create your session with `session_new` and the allowlist above.
2. <navigate, act, measure: name exactly what to measure (innerWidth, text, aria-*, computed
   styles, console errors)>
3. Save screenshots to /tmp/commerce-browse/<name>/<NN-what>.png
4. Close your tabs and delete your session.

## Out of scope
No logins, no credentials, no other sites, no destructive actions.
