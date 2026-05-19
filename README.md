# GraphQL Profile Page

A personal profile page that connects to the Reboot01 GraphQL API.

---

## 📁 Folder Structure

```
graphql-profile/
├── index.html            ← main page
└── src/
    ├── js/
    │   ├── api.js        ← login + GraphQL requests
    │   ├── charts.js     ← SVG chart drawing
    │   └── main.js       ← app logic
    └── styles/
        └── main.css      ← all styles
```

---

## 🚀 How to Run on Your Laptop

This project uses **ES Modules** (`type="module"` in the HTML), which means you **cannot** just double-click `index.html` — your browser will block it. You need a local server. Here are two easy ways:

---

### Option 1 — VS Code Live Server (easiest, recommended for beginners)

1. Open **VS Code**
2. Install the **Live Server** extension:
   - Click the Extensions icon on the left sidebar (looks like 4 squares)
   - Search for `Live Server` by Ritwick Dey
   - Click Install
3. Open the `graphql-profile` folder in VS Code (`File → Open Folder`)
4. Right-click `index.html` in the file tree → **"Open with Live Server"**
5. Your browser will open automatically at `http://127.0.0.1:5500`

---

### Option 2 — Python (if you have Python installed)

1. Open a terminal / command prompt
2. `cd` into the project folder:
   ```
   cd path/to/graphql-profile
   ```
3. Run one of these commands:
   ```bash
   # Python 3
   python3 -m http.server 8080

   # Windows (Python 3)
   python -m http.server 8080
   ```
4. Open your browser and go to: `http://localhost:8080`

---

### Option 3 — Node.js serve (if you have Node installed)

```bash
npx serve .
```

Then open the URL it shows (usually `http://localhost:3000`).

---

## 🔑 Logging In

- Use your **Reboot01 username and password**, or your **email and password**
- The domain is already set to `learn.reboot01.com`
- Your session is saved in the browser, so you won't need to log in every time

---

## 🛑 To Log Out

Click the **"Sign out"** button in the top-right corner.
