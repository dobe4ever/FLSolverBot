COMMAND TO DUMP CODEBASE INTO codebase.txt
```
> codebase.txt && find src -type f -exec sh -c 'echo "===== FILE: {} =====" >> codebase.txt; echo "\n\`\`\`" >> codebase.txt; cat "{}" >> codebase.txt; echo "\n\`\`\`\n" >> codebase.txt;' \;
```

This Telegram bot automatically redeploys to Render.com whenever new code is pushed to the GitHub repo.

Development and testing are done in GitHub Codespaces using the same repo and secrets (except for the Telegram bot token). This allows live testing directly from the browser IDE while interacting with a separate Telegram bot instance in the app.

To run locally:
`node src/index.js`

# Overview

The bot is a Fantasyland Poker solver that supports all variants (14–17 cards). It processes screenshots from any poker app where the hero is in Fantasyland mode. The image is analyzed using a vision-language model to identify visible cards, which are then passed to the solver for optimal hand arrangement.

**Flow:**
Screenshot → Telegram API (image) → Base64 → Vision model (cards → text) → Solver → Formatted solution → Telegram API (send reply)

# Files

```
FLSOLVERBOT
├── node_modules
├── src
│   ├── services
│   │   ├── gemini.service.js
│   │   └── mistral.service.js
│   ├── solver
│   │   └── solver.js
│   └── index.js
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── TODO.md
```
# Codebase
