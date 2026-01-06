COMMAND TO DUMP CODEBASE INTO codebase.txt
```
> codebase.txt && find src -type f -exec sh -c 'echo "===== FILE: {} =====" >> codebase.txt; echo "\n\`\`\`" >> codebase.txt; cat "{}" >> codebase.txt; echo "\n\`\`\`\n" >> codebase.txt;' \;
```

To run locally:
node src/index.js

# Project
Repo: https://github.com/dobe4ever/FLSolverBot
Development: Codespaces (vs code browser)
Deployment: Railway
Testing: Directly inside telegram app after push/redeploy changes

# Overview
The bot is a Fantasyland Poker solver that supports all variants (14–17 cards). It processes screenshots from any poker app where the hero is in Fantasyland mode. The image is analyzed using a vision-language model to extract the visible cards from the image, which are then passed to the solver function for optimal hand arrangement.

**Flow:**
Screenshot → Telegram API (image) → Base64 → Vision model (cards → text) → Solver → Formatted solution → Telegram API (send reply)

# Files
```
FLSOLVERBOT
├── node_modules
├── src
│   ├── services
│   │   ├── gemini.service.js
│   │   └── solver.js
│   └── index.js
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── TODO.md
```