# Crownless — Combat Prototype 0.2

A playable single-player, top-down medieval combat prototype. Mobile landscape controls and desktop keyboard/mouse controls. This repository is a **static website**; no Godot export, server, npm, or build command is required.

## Publish on GitHub Pages

1. Create a new GitHub repository named `crownless` (or another name), using a **public** repository unless your GitHub plan supports Pages from private repositories.
2. Extract `crownless_github_pages.zip` on your computer. **Upload the contents of the extracted `crownless_github_pages` folder** to the repository root, not the ZIP itself and not the outer folder. Include the hidden `.github` folder and `.nojekyll` file. Commit to the `main` branch.
3. In the repository, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Visit **Actions → Deploy Crownless to GitHub Pages** to check the deployment. If necessary, run the workflow via **Run workflow**.
5. After the workflow succeeds, open `https://YOUR-USERNAME.github.io/crownless/` (replace both username and repo name if different). You can also find the exact link under **Settings → Pages**.

Every subsequent push to `main` automatically publishes the latest version. If you prefer **Deploy from a branch**, you can select `main` and `/(root)` instead; you do not need to use the provided workflow in that case.

## Local testing

From this folder, run `python -m http.server 8000` (or `python3 -m http.server 8000`) and open `http://localhost:8000/` in your browser. Local double-clicking on `index.html` may work but serving over HTTP is the most reliable test.

## Controls

- **Desktop:** WASD or arrows to move; Space or left mouse to attack; Shift or right mouse to block; Esc to pause.
- **Phone:** Hold device **landscape**; left virtual joystick to move; right Attack/Block buttons; Pause near the top right.

## Files

- `index.html` — the playable game and styles/scripts (no build step).
- `assets/` — extracted character, troop, and grass sprites.
- `.github/workflows/deploy.yml` — automatic GitHub Pages publishing.
- `.nojekyll` — ensures the assets are served as static files without Jekyll processing.

## Status and limitations

Gate A combat demo: three enemies, sword and shield, HP and victory/defeat. No campaign world, recruitment, saves, or quests in this version. Progress from the match is not saved. Target compatibility is modern browsers, with landscape mobile recommended. This has not been validated on your own phone yet.

Source art was provided by the game creator. Before publishing the repository publicly, ensure you have the necessary rights to publish and redistribute all included sprite art.
