```
// src/services/gemini.service.js

// IMPORTS:
const { GoogleGenAI } = require("@google/genai");

// Track which API key is active
let activeKeyIndex = 0;
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2
].filter(Boolean); // Remove undefined keys

// Initialize the Gemini client
let ai = new GoogleGenAI({
    apiKey: API_KEYS[activeKeyIndex],
});

// CONST:
const MODEL_NAME = 'gemini-3-flash-preview';
const MODEL_DISPLAY_NAME = 'Gemini 3 Flash Preview';

const systemInstruction = `Your job is to extract the playing cards from the picture and return the result formatted as standard poker notation.

STEP 1 - CAREFULLY IDENTIFY EACH CARD:
Starting from the first card on the left, list each card writing out the rank and suit in words.
Format:
1. [rank], [suit]
2. [rank], [suit]
etc.

STEP 2 - CONVERT TO STANDARD NOTATION:
Use this exact notation system:
- RANKS: 2 3 4 5 6 7 8 9 T J Q K A
- SUITS: C = Clubs, D = Diamonds, H = Hearts, S = Spades

CRITICAL: 
- Ten is ALWAYS written as 'T', NEVER as '10'
- Each card is exactly 2 characters: rank + suit
- Example: TC = Ten of Clubs

STEP 3 - OUTPUT:
Provide all cards in a single line, separated by single spaces, enclosed in triple backticks.
- Example Format: \`\`\`9C TD 6S\`\`\``;

// Rotates to the next API key
function rotateApiKey() {
    if (API_KEYS.length < 2) return false;
    
    activeKeyIndex = (activeKeyIndex + 1) % API_KEYS.length;
    ai = new GoogleGenAI({
        apiKey: API_KEYS[activeKeyIndex],
    });
    console.log(`🔄 [GEMINI] Rotated to API key #${activeKeyIndex + 1}`);
    return true;
}

// Get current API key number
function getActiveKeyNumber() {
    return activeKeyIndex + 1;
}

// Get model info
function getModelInfo() {
    return {
        name: MODEL_NAME,
        displayName: MODEL_DISPLAY_NAME
    };
}

// MAIN FUNC
async function identifyCardsFromImage(imageBuffer, chatId = null, bot = null) {
    const config = {
        temperature: 0,
        thinkingConfig: {
            thinkingLevel: 'MINIMAL',
        },
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        systemInstruction: [
            {
                text: systemInstruction,
            }
        ],
    };

    const contents = [
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString("base64"),
                    },
                },
            ],
        },
    ];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            config,
            contents,
        });

        return response.text;

    } catch (error) {
        // Check if it's a quota/rate limit error
        if (error.status === 'RESOURCE_EXHAUSTED' || 
            (error.message && error.message.includes('quota'))) {
            
            // Try rotating API key automatically
            if (rotateApiKey()) {
                console.log('🔄 [GEMINI] Retrying with new API key...');
                
                // Notify user about key rotation
                if (chatId && bot) {
                    await bot.sendMessage(chatId, '⚠️ API limit reached, switching to backup key...');
                }
                
                // Retry with new key
                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    config,
                    contents,
                });
                return response.text;
            }
        }
        
        // Re-throw error for centralized handling
        throw error;
    }
}

module.exports = { 
    identifyCardsFromImage,
    getModelInfo,
    getActiveKeyNumber
};
```

```
// src/solver/solver.js

function evalHand(hand) {
  const len = hand.length;
  const ranks = new Array(13).fill(0);
  const suits = new Array(4).fill(0);
  let handRanks = [];
  for (let i = 0; i < len; i++) {
    ranks[hand[i].rank]++;
    suits[hand[i].suit]++;
    handRanks.push(hand[i].rank);
  }
  handRanks.sort((a, b) => b - a);
  const isFlush = suits.some((count) => count >= 5);
  const groups = [];
  for (let i = 12; i >= 0; i--) {
    if (ranks[i] > 0) groups.push([i, ranks[i]]);
  }
  groups.sort((a, b) => b[1] - a[1]);
  let straightHigh = -1;
  const uniqueRanks = [...new Set(handRanks)].sort((a, b) => a - b);
  if (uniqueRanks.length >= 5) {
    if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2) && uniqueRanks.includes(3)) {
      straightHigh = 3;
    } else {
      for (let i = uniqueRanks.length - 1; i >= 4; i--) {
        if (uniqueRanks[i] - uniqueRanks[i - 4] === 4) {
          straightHigh = uniqueRanks[i];
          break;
        }
      }
    }
  }
  if (len === 5) {
    if (straightHigh !== -1 && isFlush) return { cat: 8, kickers: [straightHigh] };
    if (groups[0][1] === 4) return { cat: 7, kickers: [groups[0][0], groups[1]?.[0]] };
    if (groups[0][1] === 3 && groups[1][1] === 2) return { cat: 6, kickers: [groups[0][0], groups[1][0]] };
    if (isFlush) return { cat: 5, kickers: handRanks };
    if (straightHigh !== -1) return { cat: 4, kickers: [straightHigh] };
    if (groups[0][1] === 3) return { cat: 3, kickers: [groups[0][0], ...handRanks.filter((r) => r !== groups[0][0])] };
    if (groups[0][1] === 2 && groups[1][1] === 2) return { cat: 2, kickers: [groups[0][0], groups[1][0], groups[2]?.[0]] };
    if (groups[0][1] === 2) return { cat: 1, kickers: [groups[0][0], ...handRanks.filter((r) => r !== groups[0][0])] };
    return { cat: 0, kickers: handRanks };
  } else {
    if (groups[0][1] === 3) return { cat: 3, kickers: [groups[0][0]] };
    if (groups[0][1] === 2) return { cat: 1, kickers: [groups[0][0], groups[1]?.[0]] };
    return { cat: 0, kickers: handRanks };
  }
}

function compareHands(evalA, evalB) {
  if (evalA.cat !== evalB.cat) return evalA.cat - evalB.cat;
  for (let i = 0; i < evalA.kickers.length; i++) {
    if (evalA.kickers[i] !== evalB.kickers[i]) {
      return evalA.kickers[i] - evalB.kickers[i];
    }
  }
  return 0;
}

const defaultRoyalties = {
  back: { 4: 2, 5: 4, 6: 6, 7: 10, 8: 15 },
  middle: { 3: 2, 4: 4, 5: 8, 6: 12, 7: 20, 8: 30 },
  frontPairs: { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9 },
  frontTripsBase: 10,
};

function getRoyalties(ev, tier) {
  if (tier === "back") return defaultRoyalties.back[ev.cat] || 0;
  if (tier === "middle") return defaultRoyalties.middle[ev.cat] || 0;
  if (tier === "front") {
    if (ev.cat === 3) return defaultRoyalties.frontTripsBase + ev.kickers[0];
    if (ev.cat === 1) return defaultRoyalties.frontPairs[ev.kickers[0]] || 0;
  }
  return 0;
}

function* combinations(arr, k) {
    const n = arr.length;
    if (k > n || k < 0) return;
    const indices = Array.from({ length: k }, (_, i) => i);
    while (true) {
        yield indices.map(i => arr[i]);
        let i = k - 1;
        while (i >= 0 && indices[i] === i + n - k) i--;
        if (i < 0) return;
        indices[i]++;
        for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
    }
}

function isRepeatFantasyland(backEv, middleEv, frontEv) {
  if (backEv.cat >= 7) return true;
  if (middleEv.cat >= 6) return true;
  if (frontEv.cat === 3) return true;
  return false;
}

function areDisjoint(indicesA, indicesB) {
  const setA = new Set(indicesA);
  for (const index of indicesB) {
    if (setA.has(index)) return false;
  }
  return true;
}

// ADD THIS NEW FORMATTING FUNCTION
function formatSolution({ solveTime, points, finalEV, isRepeat, discards, front, middle, back }) {
    // Local helper function to format cards with emojis
    const formatCard = (cardStr) => {
        if (!cardStr || cardStr.length < 2) return cardStr;
        const rank = cardStr.slice(0, -1);
        const suit = cardStr.slice(-1);
        switch (suit) {
            case '♠️': return rank + '♠️';
            case '❤️': return rank + '❤️';
            case '🔷': return rank + '🔷';
            case '🟢': return rank + '🟢';
            default: return cardStr;
        }
    };

    const repeatText = isRepeat ? '✅ (Repeat FL)' : '';

    const frontFormatted = front.map(formatCard).join(' ');
    const middleFormatted = middle.map(formatCard).join(' ');
    const backFormatted = back.map(formatCard).join(' ');
    const discardsFormatted = discards.map(formatCard).join(' ');

    return `*Optimal Arrangement Found!*

\`${frontFormatted}\`
\`${middleFormatted}\`
\`${backFormatted}\`

*Discards:* \`${discardsFormatted}\`

*Score:* ${finalEV.toFixed(2)} pts ${repeatText}
*Time:* ${solveTime}s`;
}


// REPLACE YOUR EXISTING solver WITH THIS
function solver(parsedCards) {
  console.log('🔍 [SOLVER V3] Starting solver with', parsedCards.length, 'cards');
  const solverStartTime = Date.now();
  
  const numCards = parsedCards.length;
  if (numCards < 13) throw new Error("Solver requires at least 13 cards.");
  
  // ... (the entire middle part of the solver function remains unchanged) ...
  console.log('⏱️  [SOLVER] Step 1: Generating all 5-card combinations...');
  const step1Start = Date.now();
  const fiveCardHands = [];
  const allCardIndices = Array.from({ length: numCards }, (_, i) => i);
  for (const indices of combinations(allCardIndices, 5)) {
    const hand = indices.map((i) => parsedCards[i]);
    const ev = evalHand(hand);
    fiveCardHands.push({ indices, hand, ev, backRoyalty: getRoyalties(ev, "back"), middleRoyalty: getRoyalties(ev, "middle") });
  }
  console.log('✅ [SOLVER] Step 1 complete:', fiveCardHands.length, 'five-card hands generated in', (Date.now() - step1Start), 'ms');
  
  console.log('⏱️  [SOLVER] Step 2: Sorting five-card hands by ROYALTY first...');
  const step2Start = Date.now();
  fiveCardHands.sort((a, b) => {
    const royaltyDiff = b.backRoyalty - a.backRoyalty;
    if (royaltyDiff !== 0) return royaltyDiff;
    return compareHands(b.ev, a.ev);
  });
  console.log('✅ [SOLVER] Step 2 complete: Sorted in', (Date.now() - step2Start), 'ms');
  
  const frontHandCache = new Map();
  let bestOverallArrangement = null;
  let bestRepeatArrangement = null;
  let pairCount = 0;
  let cacheHits = 0;
  let prunedCount = 0;

  const getBestFrontData = (remainingIndices) => {
    const cacheKey = remainingIndices.join(',');
    if (frontHandCache.has(cacheKey)) {
        cacheHits++;
        return frontHandCache.get(cacheKey);
    }

    let bestFront = null;
    let maxRoyalty = -1;

    for (const frontIndices of combinations(remainingIndices, 3)) {
        const hand = frontIndices.map(idx => parsedCards[idx]);
        const ev = evalHand(hand);
        const royalty = getRoyalties(ev, "front");

        if (royalty > maxRoyalty) {
            maxRoyalty = royalty;
        }

        const frontData = { indices: frontIndices, hand, ev, frontRoyalty: royalty };
        if (!bestFront || frontData.frontRoyalty > bestFront.frontRoyalty || (frontData.frontRoyalty === bestFront.frontRoyalty && compareHands(frontData.ev, bestFront.ev) > 0)) {
            bestFront = frontData;
        }
    }
    const result = { bestFront, maxRoyalty };
    frontHandCache.set(cacheKey, result);
    return result;
  };

  console.log('⏱️  [SOLVER] Step 3: Main search loop with Dynamic Pruning...');
  const step3Start = Date.now();

  for (let i = 0; i < fiveCardHands.length; i++) {
    const backHand = fiveCardHands[i];
    
    for (let j = i; j < fiveCardHands.length; j++) {
      pairCount++;
      const middleHand = fiveCardHands[j];
      
      if (compareHands(backHand.ev, middleHand.ev) < 0) continue;

      const currentBestScore = bestOverallArrangement?.points ?? -1;

      if (backHand.backRoyalty + middleHand.middleRoyalty < currentBestScore - 22) {
          prunedCount++;
          continue;
      }

      if (!areDisjoint(backHand.indices, middleHand.indices)) continue;
      
      const usedIndices = new Set([...backHand.indices, ...middleHand.indices]);
      const remainingIndices = allCardIndices.filter((idx) => !usedIndices.has(idx));
      
      const { bestFront, maxRoyalty } = getBestFrontData(remainingIndices);

      if (backHand.backRoyalty + middleHand.middleRoyalty + maxRoyalty < currentBestScore) {
          prunedCount++;
          continue;
      }

      if (bestFront && compareHands(middleHand.ev, bestFront.ev) >= 0) {
        const points = backHand.backRoyalty + middleHand.middleRoyalty + bestFront.frontRoyalty;
        const currentArrangement = { points, backEv: backHand.ev, middleEv: middleHand.ev, frontEv: bestFront.ev, backData: backHand, middleData: middleHand, frontData: bestFront };
        
        if (!bestOverallArrangement || points > bestOverallArrangement.points) {
          bestOverallArrangement = currentArrangement;
        } else if (points === bestOverallArrangement.points) {
          const frontComp = compareHands(currentArrangement.frontEv, bestOverallArrangement.frontEv);
          if (frontComp > 0) {
            bestOverallArrangement = currentArrangement;
          } else if (frontComp === 0) {
            const midComp = compareHands(currentArrangement.middleEv, bestOverallArrangement.middleEv);
            if (midComp > 0) {
              bestOverallArrangement = currentArrangement;
            } else if (midComp === 0) {
              if (compareHands(currentArrangement.backEv, bestOverallArrangement.backEv) > 0) {
                bestOverallArrangement = currentArrangement;
              }
            }
          }
        }
        
        const isRepeat = isRepeatFantasyland(backHand.ev, middleHand.ev, bestFront.ev);
        if (isRepeat) {
          if (!bestRepeatArrangement || points > bestRepeatArrangement.points) {
            bestRepeatArrangement = currentArrangement;
          } else if (points === bestRepeatArrangement.points) {
            const frontComp = compareHands(currentArrangement.frontEv, bestRepeatArrangement.frontEv);
            if (frontComp > 0) {
              bestRepeatArrangement = currentArrangement;
            } else if (frontComp === 0) {
              const midComp = compareHands(currentArrangement.middleEv, bestRepeatArrangement.middleEv);
              if (midComp > 0) {
                bestRepeatArrangement = currentArrangement;
              } else if (midComp === 0) {
                if (compareHands(currentArrangement.backEv, bestRepeatArrangement.backEv) > 0) {
                  bestRepeatArrangement = currentArrangement;
                }
              }
            }
          }
        }
      }
    }
  }
  console.log(`✅ [SOLVER] Step 3 complete in ${(Date.now() - step3Start)} ms.`);
  console.log(`   [SOLVER] Stats: Pairs checked: ${pairCount} | Pairs pruned: ${prunedCount} | Cache hits: ${cacheHits} | Cache size: ${frontHandCache.size}`);

  if (!bestOverallArrangement) {
    throw new Error("Solver returned no valid arrangement");
  }
  
  console.log('⏱️  [SOLVER] Step 4: Final selection...');
  const step4Start = Date.now();
  const overallScore = bestOverallArrangement.points;
  const repeatEVScore = bestRepeatArrangement ? bestRepeatArrangement.points + 8.25 : -1;
  let finalChoice = bestOverallArrangement;
  let isRepeatChoice = false;
  let finalPoints = overallScore;
  if (repeatEVScore > overallScore) {
    finalChoice = bestRepeatArrangement;
    isRepeatChoice = true;
    finalPoints = repeatEVScore;
  }
  const finalUsedIndices = new Set([...finalChoice.backData.indices, ...finalChoice.middleData.indices, ...finalChoice.frontData.indices]);
  const discardIndices = allCardIndices.filter(i => !finalUsedIndices.has(i));

  const sortByRankDesc = (cards) =>
    [...cards].sort((a, b) => b.rank - a.rank).map((c) => c.str);
  
  console.log('✅ [SOLVER] Step 4 complete in', (Date.now() - step4Start), 'ms');
  
  // Calculate final time and format the solution
  const solveTime = ((Date.now() - solverStartTime) / 1000).toFixed(3);
  console.log('🎉 [SOLVER] TOTAL SOLVER TIME:', solveTime * 1000, 'ms');
  
  const solutionMessage = formatSolution({
      solveTime,
      points: finalChoice.points,
      finalEV: finalPoints,
      isRepeat: isRepeatChoice,
      discards: sortByRankDesc(discardIndices.map((i) => parsedCards[i])),
      front: sortByRankDesc(finalChoice.frontData.hand),
      middle: sortByRankDesc(finalChoice.middleData.hand),
      back: sortByRankDesc(finalChoice.backData.hand)
  });

  return { solutionMessage };
}

module.exports = { solver };
```

```
// src/index.js

// IMPORTED MODULES:
const TelegramBot = require('node-telegram-bot-api');
const geminiService = require('./services/gemini.service.js');
const { solver } = require('./services/solver.js');

// ENV VARIABLES
const token = process.env.TELEGRAM_BOT_TOKEN;

// BOT
const bot = new TelegramBot(token, { polling: true });

// FUNCTION DEF:
async function identifyCardsFromImage(imageBuffer, chatId) {
    return geminiService.identifyCardsFromImage(imageBuffer, chatId, bot);
}

function parseResponse(responseText) {
    // CONSTANTS FOR PARSING:
    const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const SUITS = ["♠️", "❤️", "🔷", "🟢"];
    const SUIT_MAP = { "♠️": 0, "❤️": 1, "🔷": 2, "🟢": 3, S: 0, H: 1, D: 2, C: 3 };

    // 1. Extract content between backticks
    const match = responseText.match(/```([\s\S]*?)```/);
    if (!match || !match[1]) return null;

    const cardString = match[1].trim();
    const cardCodes = cardString.split(/\s+/);

    // 2. Parse into objects
    const parsedCards = cardCodes.map(code => {
        if (!code || code.length < 2) return null;
        const c = code.trim().toUpperCase();
        const r = c[0];
        const sRaw = c.slice(1);
        const rank = RANKS.indexOf(r);
        const suit = SUIT_MAP[sRaw];
        
        if (rank === -1 || suit === undefined) return null;
        return { rank, suit, str: r + SUITS[suit] };
    }).filter(c => c !== null);

    // Basic validation: Solver needs at least 13 cards
    if (parsedCards.length < 13) return null;

    return parsedCards;
}

function extractErrorMessage(error) {
    if (error.message && error.message.includes('Body:')) {
        try {
            const bodyMatch = error.message.match(/Body: ({.*})/);
            if (bodyMatch && bodyMatch[1]) {
                const bodyObj = JSON.parse(bodyMatch[1]);
                if (bodyObj.message) return bodyObj.message;
            }
        } catch (e) {}
    }
    if (error.message) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) return parsed.error.message;
        } catch (e) {
            if (!error.message.includes('ApiError') && !error.message.includes('SDKError') && !error.message.includes('Status ') && !error.message.includes('Body:')) {
                return error.message;
            }
        }
    }
    if (error.error && error.error.message) return error.error.message;
    return 'API error occurred';
}

// BOT COMMANDS:
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const modelInfo = geminiService.getModelInfo();
    const apiKeyNum = geminiService.getActiveKeyNumber();
    
    const startMessage = `Hello! 👋 Send me a screenshot of your cards.

*Current Model:* ${modelInfo.displayName}
*API Key:* #${apiKeyNum}`;
    
    bot.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
});

// PHOTO HANDLER (COMPRESSED IMAGE):
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution

    try {
        bot.sendChatAction(chatId, 'typing');
        const fileStream = bot.getFileStream(photo.file_id);
        const chunks = [];
        for await (const chunk of fileStream) {
            chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        await main(chatId, imageBuffer);
    } catch (error) {
        console.error("Photo Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image.");
    }
});

// DOCUMENT HANDLER (UNCOMPRESSED IMAGE):
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;

    if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        return; // Ignore non-image documents
    }

    try {
        bot.sendChatAction(chatId, 'typing');
        const fileStream = bot.getFileStream(document.file_id);
        const chunks = [];
        for await (const chunk of fileStream) {
            chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        await main(chatId, imageBuffer);
    } catch (error) {
        console.error("Document Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image file.");
    }
});

// MAIN PROCESSING FUNCTION:
async function main(chatId, imageBuffer) {
    try {
        bot.sendChatAction(chatId, 'typing');
        
        const responseText = await identifyCardsFromImage(imageBuffer, chatId);
        const parsedCards = parseResponse(responseText);

        if (!parsedCards) {
            const modelInfo = geminiService.getModelInfo();
            const errorMsg = `❌ ${modelInfo.displayName}: Could not extract cards from image.\n\nPlease try again with a clearer screenshot.`;
            await bot.sendMessage(chatId, errorMsg);
            return;
        }
        
        const { solutionMessage } = solver(parsedCards);
        await bot.sendMessage(chatId, solutionMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Processing Error:", error);
        const modelInfo = geminiService.getModelInfo();
        let errorMessage;
        
        if (error.message && (error.message.includes('Solver') || error.message.includes('at least 13 cards'))) {
            errorMessage = 'Solver Error: ' + error.message;
        } else {
            errorMessage = extractErrorMessage(error);
        }
        
        const errorMsg = `❌ ${modelInfo.displayName}: ${errorMessage}\n\nPlease try again.`;
        await bot.sendMessage(chatId, errorMsg);
    }
}

console.log('🚀 FL Solver Bot is running!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});
```