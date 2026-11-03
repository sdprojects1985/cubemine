# Cubemine

A Minesweeper prototype played on the six connected faces of a cube. Spanish is the default language; English is available in the header.

Dragging right moves the facing surface right, and dragging down moves it down, even with the cube upside down. Numbers, flags and mines sit flat on the tiles. Each mark turns within its face so its vertical direction stays readable while its width follows the face’s perspective. The same treatment applies to `{n}`, `-n-` and outside line clues.

**This folder is ready to become your own GitHub repository.** It has no account connection, API key, external runtime dependency or ChatGPT hosting requirement. The playable site is entirely in `dist/`.

For Spanish upload instructions, see [SUBIR_A_GITHUB.md](SUBIR_A_GITHUB.md).

## Publish on your GitHub account

1. Extract the ZIP. Open the inner `cubemine` folder containing this README, `dist`, `tests`, `scripts` and `.github`.
2. Create a new repository in **your GitHub account**, for example `cubemine`. A public repository is the simplest option for GitHub Pages on a free account. Leave the initial README, license and `.gitignore` options unchecked because the package already contains its own files.
3. Upload the **contents** of this folder to the repository root, including `.github/workflows/pages.yml`. Do not upload the ZIP itself or add an extra `cubemine/` folder around the contents. Using GitHub Desktop or the Git commands below makes it easier to retain dot-prefixed folders.
4. Open the repository's **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
5. In **Actions**, choose **Test and deploy Cubemine → Run workflow**, using `main`. This is useful if the first push ran before Pages was enabled. Later pushes to `main` deploy automatically after checks pass.
6. When the workflow succeeds, use the URL shown under **Settings → Pages** or the `github-pages` deployment. For a repository named `cubemine`, the normal project-site address is `https://YOUR-USERNAME.github.io/cubemine/`. Replace `YOUR-USERNAME` with your actual account name. This is an example format, not an already-created URL.

The workflow verifies the game and uploads only `dist/`. It uses GitHub's built-in permissions; no personal access token or custom deployment secret needs to be added to the workflow. Pull requests run checks without deploying.

### Upload with Git

Run these from the extracted folder containing `package.json`, after creating an empty repository on GitHub. Replace `YOUR-USERNAME` and, if needed, `cubemine` in the remote URL. Git uses your normal GitHub authentication; no token belongs in these files.

```bash
git init -b main
git add .
git commit -m "Add Cubemine prototype"
git remote add origin https://github.com/YOUR-USERNAME/cubemine.git
git push -u origin main
```

Then select **GitHub Actions** in Pages settings and run the workflow as described above. If you choose a different default branch, update the `main` branch references in `.github/workflows/pages.yml`.

### Upload through the GitHub website

Use **Add file → Upload files** and upload the extracted contents. Some file pickers hide `.github`. If it is missing, use **Add file → Create new file**, enter `.github/workflows/pages.yml` as the filename, and paste the complete contents of the packaged workflow. Commit to `main`. The root should contain `dist/index.html`, not `cubemine/dist/index.html`.

## Run locally

Install Node.js 24 or later. There are no packages to install and no build step.

```bash
npm start
```

Open `http://127.0.0.1:8080/`. To test the same nested path used by a GitHub project site:

```bash
npm start -- --base-path /cubemine/
```

Open `http://127.0.0.1:8080/cubemine/`. Use an HTTP server; opening `index.html` directly as a `file:` URL may block JavaScript modules.

## Validate before publishing

```bash
npm run check
npm test
```

All 47 automated checks pass. They cover the Minesweeper rules, all 12 fixed puzzle solutions, visible opening deductions, hidden-data independence, Spanish and English parity, saved progress, screen-relative rotation, stable zoom, the orientation and perspective of surface marks, and serving under a repository subpath. Visual and hands-on checks are pending because the browser preview service was unavailable for this release.

## Play

- **Random / Aleatorio:** fresh mines with a safe first reveal; 4 × 4, 6 × 6 or 8 × 8 cells per face. Classic random boards may require guessing.
- **Puzzles / Puzles:** 12 fixed layouts with deduction-only solution paths and visible opening moves. Mistakes do not end a puzzle.
- `{n}` means the neighboring mines form one consecutive run around the clue. `-n-` means at least two separate groups. Outside numbers count mines in a face-local row or column.
- Drag to rotate; scroll to zoom. Click to reveal. Right-click, hold, Shift-click or select Flag mode to mark. Use face buttons or Unfold to inspect the whole board.

Progress is saved in the browser. Moving to a new domain starts a separate save; existing progress on another domain is not automatically transferred. No accounts or server database are used.

## Project files

| Location | Purpose |
| --- | --- |
| `dist/` | Complete playable game; deployed by Pages |
| `dist/camera.mjs` | Screen-relative rotation, smooth camera transitions and reading angles on the cube surface |
| `dist/markings.mjs` | Tile and line markings rendered inside their buttons |
| `tests/` | Game, puzzle, localization and hosting checks |
| `scripts/serve.mjs` | Dependency-free local HTTP server |
| `scripts/check.mjs` | Syntax and repository-path validation |
| `scripts/curate-puzzles.mjs` | Authoring tool that overwrites fixed puzzle data; not part of deployment |
| `scripts/repair-openings.mjs` | Authoring tool for visible initial clues; not part of deployment |
| `.github/workflows/pages.yml` | Validation and GitHub Pages deployment |
| `TECHNICAL_NOTES.md` | Rules and verification details |

The future UE 5.8.4 version, polished VFX/SFX/music, adventure unlocks, stars, achievements and optional additional modes are production proposals, not features of this browser prototype. Internal pitch/design documents are not included in the public repository package.

## Troubleshooting

- **Pages reports “Not Found” during setup:** first set the Pages source to GitHub Actions, then rerun the workflow.
- **Only a README appears:** confirm that the provided workflow is present and Pages uses GitHub Actions rather than publishing the repository root from a branch.
- **No workflow appears:** check `.github/workflows/pages.yml` exists at the repository root and Actions is enabled for the repository.
- **The page is missing:** wait for the deployment job to succeed and use the exact Pages URL, including the repository name.
- **An old version appears:** refresh the page after the deployment finishes. The app does not install a service worker.

Official setup references: [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
