COMMAND TO DUMP CODEBASE INTO codebase.txt
```
> codebase.txt && find src -type f -exec sh -c 'echo "===== FILE: {} =====" >> codebase.txt; echo "\n\`\`\`" >> codebase.txt; cat "{}" >> codebase.txt; echo "\n\`\`\`\n" >> codebase.txt;' \;
```

This Telegram bot is deployed to railway.com

Development is done on Codespaces (vs code browser). Railway uses the same github repo for deployment when pushing changes. The bot is tested directly inside telegram & the logs can be checked on railway.

To run locally:
`node src/index.js`

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