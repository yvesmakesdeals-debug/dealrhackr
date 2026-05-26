# DEALRHCKR — Deploy to Netlify
### Live in about 45 minutes. All free.

---

## What you need (all free)

| Thing | Why | Where |
|---|---|---|
| Node.js | Builds the app | nodejs.org |
| Netlify account | Hosts the site | netlify.com |
| MarketCheck key | Real inventory | developers.marketcheck.com |
| dealrhckr.com domain | Optional but buy it now | namecheap.com |

---

## Step 1 — Install Node.js (5 min)

1. Go to **nodejs.org**
2. Click the big **LTS** button to download
3. Open the downloaded file → click through the installer
4. Done

---

## Step 2 — Get your MarketCheck API key (5 min)

1. Go to **developers.marketcheck.com**
2. Click **Sign Up**
3. Create a free account
4. Copy your API key — looks like `abc123xyz...`
5. Save it somewhere — you'll paste it into Netlify in Step 5

---

## Step 3 — Build and test locally (10 min)

Open **Terminal** (Mac: press Cmd+Space, type Terminal)  
**Windows:** press Windows key, type Command Prompt

Run these commands one at a time. Press Enter after each:

```
cd dealrhckr-deploy
npm install
npm run build
```

You'll see it say "built in X seconds" — that means it worked.

---

## Step 4 — Deploy to Netlify (10 min)

Still in Terminal, run:

```
npx netlify-cli deploy --prod --dir=dist
```

The first time it asks you to log in:
- It opens your browser → log in or create a free Netlify account
- Come back to Terminal and press Enter when prompted
- When it asks **"Link to existing site or create new"** → choose **Create new site**
- It will print a URL like `https://random-name-123.netlify.app` — that's your live site

---

## Step 5 — Add your MarketCheck key to Netlify (5 min)

This is how live inventory works. The key is stored secretly in Netlify — never in your code.

1. Go to **app.netlify.com**
2. Click your site (dealrhckr or whatever it named it)
3. Go to **Site configuration → Environment variables**
4. Click **Add a variable**
5. Key: `MARKETCHECK_KEY`
6. Value: paste your MarketCheck API key
7. Click **Save**
8. Go to **Deploys → Trigger deploy → Deploy site**

The site will rebuild in ~30 seconds. After that, searching inventory pulls real live data from every dealer nationwide.

---

## Step 6 — Connect dealrhckr.com (5 min, if you bought the domain)

1. In Netlify → your site → **Domain management**
2. Click **Add a domain**
3. Type `dealrhckr.com` → click Verify
4. Follow the DNS instructions — copy 2 lines into Namecheap
5. Live on your domain within 10-30 minutes

---

## How to see your leads

**From any device:**
Go to **app.netlify.com** → your site → **Forms** → click **lead**
Every concierge request appears here with name, phone, email, vehicle, and all details.

**From the app (same device as submission):**
Go to your site → tap **Admin ↗** in the top right → sign in
Password is set in `src/App.jsx` at the top: `ADMIN_PASSWORD: "dealrhckr"` — change it.

---

## How to change the flat fee

Open `src/App.jsx` in any text editor.
Find line 4:
```
FLAT_FEE: 499,
```
Change 499 to whatever you want. Save the file.

Then redeploy:
```
npm run build
npx netlify-cli deploy --prod --dir=dist
```

---

## If something breaks

**"npm: command not found"** → Node.js didn't install right. Restart Terminal and try nodejs.org again.

**"netlify: command not found"** → run `npm install -g netlify-cli` first.

**Inventory not loading** → Check that MARKETCHECK_KEY is set in Netlify environment variables and you redeployed after adding it.

**Leads not showing in Netlify dashboard** → Make sure you deployed the site (the hidden form in index.html has to be picked up by Netlify on the first deploy).

---

## Files in this project

```
dealrhckr-deploy/
├── src/
│   ├── App.jsx          ← all the UI + logic. Edit CONFIG at the top
│   └── main.jsx         ← don't touch
├── netlify/
│   └── functions/
│       └── inventory.js ← proxies MarketCheck. Don't touch.
├── index.html           ← includes hidden form for Netlify leads
├── package.json         ← don't touch
├── vite.config.js       ← don't touch
├── netlify.toml         ← tells Netlify how to build. Don't touch.
└── README.md            ← this file
```

Only file you ever need to edit: **src/App.jsx** (fee, password, etc.)
