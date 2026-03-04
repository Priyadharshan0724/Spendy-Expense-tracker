# Expense Tracker App

Simple client-side expense tracker built with HTML, CSS and JavaScript.

## Description

- Lightweight web app to add and view expenses locally in the browser.
- Uses the files in the `files/` directory: UI and Firebase integration code.

## Project structure

- files/
  - index.html — main UI
  - style.css — styles
  - app.js — app logic
  - firebase.js — firebase config (if used)

## Run locally

1. Open the app in your browser by double-clicking `files/index.html`.
2. Or run a local static server and open the URL (recommended):

```bash
# from the project root
python -m http.server 8000
# then open http://localhost:8000/files/index.html
```

## Add README / push to GitHub (example commands)

```bash
# initialize repo (if not already)
git init
git add .
git commit -m "Initial commit"
git branch -M main
# add remote (replace URL) and push
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

To enable GitHub Pages, set the repository's Pages source to `main` / `/root` in GitHub settings.

## License

Choose a license for your project (MIT recommended).
