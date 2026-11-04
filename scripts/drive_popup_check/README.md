# drive_popup_check — the Drive sign-in window in a real browser (owner, urgent 2026-11-04)

Builds a tiny page from the REAL `src/lib/driveAuth.js` and drives it with Playwright: one window only (a second click
opens none), closing the window ⇒ «حساب گوگل را در پنجرهٔ کوچک انتخاب کنید … تلاش دوباره», and the timeout closes the
window itself. Google's own account page cannot be automated here; this checks OUR side of the flow.

```bash
D=$(mktemp -d) && cp scripts/drive_popup_check/{entry.js,index.html,run.cjs} "$D"/ && sed -i "s#'../../src/lib/driveAuth.js'#'$PWD/src/lib/driveAuth.js'#" "$D/entry.js" && npx esbuild "$D/entry.js" --bundle --outfile="$D/bundle.js" && node "$D/run.cjs" "$D"
```
