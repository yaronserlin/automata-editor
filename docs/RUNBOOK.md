# Runbook

Automata Editor is a static site: no backend, no database, no environment variables, and no build step at deploy time. GitHub Pages serves the files on `main` exactly as committed.

## Production

<!-- AUTO-GENERATED: deployment target (source: `gh api repos/yaronserlin/automata-editor/pages`, index.html) -->
| Setting | Value |
|---------|-------|
| Host | GitHub Pages |
| URL | <https://yaronserlin.github.io/automata-editor/> |
| Source | branch `main`, folder `/` (repository root) |
| Runtime dependency | KaTeX 0.16.8 from `cdn.jsdelivr.net` (pinned with Subresource Integrity hashes) |
| Demo media | README GIFs, screenshots, and videos are not served by Pages. They are hosted on the [Demo media release](https://github.com/yaronserlin/automata-editor/releases/tag/demo-media) |
<!-- /AUTO-GENERATED -->

## Deploying

1. Start from an up-to-date `main` with a clean working tree.
2. Install and run the same checks as CI:
   ```bash
   npm ci
   npm run lint
   npm run check:css   # if this fails: npm run build:css, then commit css/tailwind.generated.css
   npm test
   ```
3. On GitHub, confirm the [CI workflow](https://github.com/yaronserlin/automata-editor/actions/workflows/ci.yml) is green for the branch or pull request. CI only checks; it does not deploy.
4. Push (or merge the pull request) to `main`. Pages starts a build automatically.
5. Confirm the build finished for your commit — expect `"status": "built"` and a `commit` equal to `git rev-parse HEAD`:
   ```bash
   gh api repos/yaronserlin/automata-editor/pages/builds/latest --jq '{status, commit, error: .error.message}'
   ```
6. Run the smoke test below.

Pages processes the site with Jekyll because there is no `.nojekyll` file, and Jekyll drops files and folders whose names start with `_`. Nothing in the repository does today; if you add one, also add an empty `.nojekyll` at the root.

## Smoke test

There is no health endpoint. After each deploy:

```bash
for page in "" js/main.js css/tailwind.generated.css; do
  curl -s -o /dev/null -w "%{http_code} /$page\n" "https://yaronserlin.github.io/automata-editor/$page"
done
```

Every line should start with `200`. Then open the site in a browser and check that:

- The seed diagram appears — start state q₀ connected by a transition labeled *a* to accept state q₁ — with labels typeset as math (confirms KaTeX loaded).
- The DevTools console shows no errors.
- Double-clicking empty canvas adds a state, Save then Load restores the diagram, and Download SVG / Download LaTeX each produce a file.

## Common issues

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Page loads but the canvas stays empty; console shows a CORS or "Failed to load module script" error | `index.html` opened via `file://` | Serve over HTTP, e.g. `python3 -m http.server 8000` |
| Styles missing or wrong after a change | `css/tailwind.generated.css` not rebuilt/committed, or Tailwind classes used outside `index.html` were purged | `npm run build:css` and commit; add new class-bearing files to `content` in `tailwind.config.js` |
| Labels show raw source such as `q_{0}` instead of math | KaTeX failed to load from jsDelivr (offline, CDN outage, content blocker); `GeometryUtils.renderKatex` falls back to plain text | Check access to `cdn.jsdelivr.net`. Editing, save/load, and both exports keep working — exports don't use KaTeX |
| Load alerts "Error parsing the file. Please ensure it is valid JSON." | The file is not valid JSON | Load a file produced by **Save** (`automata_project.json`) |
| Load alerts "Invalid project file structure." | Valid JSON, but `AutomatonGraph.fromRaw` rejected its top-level shape | Compare against a freshly saved project file |
| Load alerts "Loaded with N invalid node/edge entries skipped." | Malformed states, or transitions referencing missing states, were dropped | The rest of the diagram loaded; fix or remove those entries in the JSON |
| `npm ci` warns `EBADENGINE`, or `npm test` fails at startup | Node version older than Vitest 5 supports | Use Node `^22.12.0`, `^24`, or `>=26` |
| CI fails at **Check committed CSS is up to date** | `index.html` classes changed but `css/tailwind.generated.css` was not rebuilt | `npm run build:css` and commit the result |
| CI fails at **Lint** | ESLint found a problem (often an unused import or variable) | Run `npm run lint` locally and fix the reported lines |
| Demo GIFs or screenshots missing from the README | They are GitHub user attachments and only load on github.com | View them on the [Demo media release](https://github.com/yaronserlin/automata-editor/releases/tag/demo-media) |
| A new deploy isn't visible | Pages build still running or failed, or a cached response | Check the build (Deploying, step 5), then hard-refresh |

## Rollback

Deploys are plain commits on `main`, so rolling back is a revert:

```bash
git revert <bad-commit-sha>
git push origin main
```

Then repeat Deploying steps 5–6. Prefer `git revert` over force-pushing so `main`'s history stays intact for anyone who has already pulled it.

To take the site offline entirely in an emergency, unpublish it from the repository's **Settings → Pages**.

## Monitoring, alerting, and escalation

- **Monitoring:** none. No analytics, error reporting, or uptime checks. Use the smoke test above on demand.
- **CI:** [GitHub Actions](https://github.com/yaronserlin/automata-editor/actions/workflows/ci.yml) runs lint, the CSS check, and tests on every push and pull request. GitHub emails the pusher when a run fails.
- **Build status:** `gh api repos/yaronserlin/automata-editor/pages/builds/latest`, or **Settings → Pages** in the repository.
- **Alerting:** none configured.
- **Escalation:** the repository owner, [@yaronserlin](https://github.com/yaronserlin).
