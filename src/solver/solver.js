// // src/solver/solver.js

// const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
// const SUITS = ["♠️", "❤️", "🔷", "🟢"];
// const SUIT_MAP = { "♠️": 0, "❤️": 1, "🔷": 2, "🟢": 3, S: 0, H: 1, D: 2, C: 3 };

// function parseCard(code) {
//   if (!code || code.length < 2) return null;
//   const c = code.trim().toUpperCase();
//   const r = c[0];
//   const sRaw = c.slice(1);
//   const rank = RANKS.indexOf(r);
//   const suit = SUIT_MAP[sRaw];
//   if (rank === -1 || suit === undefined) return null;
//   return { rank, suit, str: r + SUITS[suit] };
// }

// function evalHand(hand) {
//   const len = hand.length;
//   const ranks = new Array(13).fill(0);
//   const suits = new Array(4).fill(0);
//   let handRanks = [];
//   for (let i = 0; i < len; i++) {
//     ranks[hand[i].rank]++;
//     suits[hand[i].suit]++;
//     handRanks.push(hand[i].rank);
//   }
//   handRanks.sort((a, b) => b - a);
//   const isFlush = suits.some((count) => count >= 5);
//   const groups = [];
//   for (let i = 12; i >= 0; i--) {
//     if (ranks[i] > 0) groups.push([i, ranks[i]]);
//   }
//   groups.sort((a, b) => b[1] - a[1]);
//   let straightHigh = -1;
//   const uniqueRanks = [...new Set(handRanks)].sort((a, b) => a - b);
//   if (uniqueRanks.length >= 5) {
//     if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2) && uniqueRanks.includes(3)) {
//       straightHigh = 3;
//     } else {
//       for (let i = uniqueRanks.length - 1; i >= 4; i--) {
//         if (uniqueRanks[i] - uniqueRanks[i - 4] === 4) {
//           straightHigh = uniqueRanks[i];
//           break;
//         }
//       }
//     }
//   }
//   if (len === 5) {
//     if (straightHigh !== -1 && isFlush) return { cat: 8, kickers: [straightHigh] };
//     if (groups[0][1] === 4) return { cat: 7, kickers: [groups[0][0], groups[1]?.[0]] };
//     if (groups[0][1] === 3 && groups[1][1] === 2) return { cat: 6, kickers: [groups[0][0], groups[1][0]] };
//     if (isFlush) return { cat: 5, kickers: handRanks };
//     if (straightHigh !== -1) return { cat: 4, kickers: [straightHigh] };
//     if (groups[0][1] === 3) return { cat: 3, kickers: [groups[0][0], ...handRanks.filter((r) => r !== groups[0][0])] };
//     if (groups[0][1] === 2 && groups[1][1] === 2) return { cat: 2, kickers: [groups[0][0], groups[1][0], groups[2]?.[0]] };
//     if (groups[0][1] === 2) return { cat: 1, kickers: [groups[0][0], ...handRanks.filter((r) => r !== groups[0][0])] };
//     return { cat: 0, kickers: handRanks };
//   } else {
//     if (groups[0][1] === 3) return { cat: 3, kickers: [groups[0][0]] };
//     if (groups[0][1] === 2) return { cat: 1, kickers: [groups[0][0], groups[1]?.[0]] };
//     return { cat: 0, kickers: handRanks };
//   }
// }

// function compareHands(evalA, evalB) {
//   if (evalA.cat !== evalB.cat) return evalA.cat - evalB.cat;
//   for (let i = 0; i < evalA.kickers.length; i++) {
//     if (evalA.kickers[i] !== evalB.kickers[i]) {
//       return evalA.kickers[i] - evalB.kickers[i];
//     }
//   }
//   return 0;
// }

// const defaultRoyalties = {
//   back: { 4: 2, 5: 4, 6: 6, 7: 10, 8: 15 },
//   middle: { 3: 2, 4: 4, 5: 8, 6: 12, 7: 20, 8: 30 },
//   frontPairs: { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9 },
//   frontTripsBase: 10,
// };

// function getRoyalties(ev, tier) {
//   if (tier === "back") return defaultRoyalties.back[ev.cat] || 0;
//   if (tier === "middle") return defaultRoyalties.middle[ev.cat] || 0;
//   if (tier === "front") {
//     if (ev.cat === 3) return defaultRoyalties.frontTripsBase + ev.kickers[0];
//     if (ev.cat === 1) return defaultRoyalties.frontPairs[ev.kickers[0]] || 0;
//   }
//   return 0;
// }

// function* combinations(n, k) {
//   if (k > n || k < 0) return;
//   const indices = Array.from({ length: k }, (_, i) => i);
//   while (true) {
//     yield indices;
//     let i = k - 1;
//     while (i >= 0 && indices[i] === i + n - k) i--;
//     if (i < 0) return;
//     indices[i]++;
//     for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
//   }
// }

// function isRepeatFantasyland(backEv, middleEv, frontEv) {
//   if (backEv.cat >= 7) return true;
//   if (middleEv.cat >= 6) return true;
//   if (frontEv.cat === 3) return true;
//   return false;
// }

// function areDisjoint(indicesA, indicesB) {
//   const setA = new Set(indicesA);
//   for (const index of indicesB) {
//     if (setA.has(index)) return false;
//   }
//   return true;
// }

// function solveOptimizedV2(parsedCards) {
//   console.log('🔍 [SOLVER] Starting solver with', parsedCards.length, 'cards');
//   const solverStartTime = Date.now();
  
//   const numCards = parsedCards.length;
//   if (numCards < 13) throw new Error("Solver requires at least 13 cards.");
  
//   let bestOverallArrangement = null;
//   let bestRepeatArrangement = null;
  
//   console.log('⏱️  [SOLVER] Step 1: Generating all 5-card combinations...');
//   const step1Start = Date.now();
//   const fiveCardHands = [];
//   for (const indices of combinations(numCards, 5)) {
//     const hand = indices.map((i) => parsedCards[i]);
//     const ev = evalHand(hand);
//     fiveCardHands.push({ indices: [...indices], hand, ev, backRoyalty: getRoyalties(ev, "back"), middleRoyalty: getRoyalties(ev, "middle") });
//   }
//   console.log('✅ [SOLVER] Step 1 complete:', fiveCardHands.length, 'five-card hands generated in', (Date.now() - step1Start), 'ms');
  
//   console.log('⏱️  [SOLVER] Step 2: Building 3-card hand cache...');
//   const step2Start = Date.now();
//   const threeCardHandCache = new Map();
//   for (const indices of combinations(numCards, 3)) {
//     const key = [...indices].sort((a, b) => a - b).join(",");
//     const hand = indices.map((i) => parsedCards[i]);
//     const ev = evalHand(hand);
//     threeCardHandCache.set(key, { indices: [...indices], hand, ev, frontRoyalty: getRoyalties(ev, "front") });
//   }
//   console.log('✅ [SOLVER] Step 2 complete:', threeCardHandCache.size, 'three-card hands cached in', (Date.now() - step2Start), 'ms');
  
//   console.log('⏱️  [SOLVER] Step 3: Sorting five-card hands...');
//   const step3Start = Date.now();
//   fiveCardHands.sort((a, b) => compareHands(b.ev, a.ev));
//   console.log('✅ [SOLVER] Step 3 complete: Sorted in', (Date.now() - step3Start), 'ms');
  
//   const allCardIndices = Array.from({ length: numCards }, (_, i) => i);
//   const MAX_FRONT_ROYALTY = 22;
  
//   console.log('⏱️  [SOLVER] Step 4: Main search loop (this is the heavy part)...');
//   const step4Start = Date.now();
//   let pairCount = 0;
//   let validArrangements = 0;
  
//   for (let i = 0; i < fiveCardHands.length; i++) {
//     const backHand = fiveCardHands[i];
    
//     // Progress logging every 100 back hands
//     if (i % 100 === 0 && i > 0) {
//       console.log(`   [SOLVER] Progress: ${i}/${fiveCardHands.length} back hands processed (${validArrangements} valid arrangements found)`);
//     }
    
//     for (let j = i; j < fiveCardHands.length; j++) {
//       pairCount++;
//       const middleHand = fiveCardHands[j];
//       const currentBestScore = bestOverallArrangement?.points ?? -1;
//       if (backHand.backRoyalty + middleHand.middleRoyalty + MAX_FRONT_ROYALTY < currentBestScore) continue;
//       if (!areDisjoint(backHand.indices, middleHand.indices)) continue;
//       const usedIndices = new Set([...backHand.indices, ...middleHand.indices]);
//       const remainingIndices = allCardIndices.filter((idx) => !usedIndices.has(idx));
//       let bestFrontForPair = null;
//       for (const frontIndices of combinations(remainingIndices.length, 3)) {
//         const actualFrontIndices = frontIndices.map(idx => remainingIndices[idx]);
//         const key = actualFrontIndices.sort((a, b) => a - b).join(",");
//         const frontHand = threeCardHandCache.get(key);
//         if (compareHands(middleHand.ev, frontHand.ev) >= 0) {
//           if (!bestFrontForPair || frontHand.frontRoyalty > bestFrontForPair.frontRoyalty) {
//             bestFrontForPair = frontHand;
//           } else if (frontHand.frontRoyalty === bestFrontForPair.frontRoyalty) {
//             if (compareHands(frontHand.ev, bestFrontForPair.ev) > 0) {
//               bestFrontForPair = frontHand;
//             }
//           }
//         }
//       }
//       if (bestFrontForPair) {
//         validArrangements++;
//         const points = backHand.backRoyalty + middleHand.middleRoyalty + bestFrontForPair.frontRoyalty;
//         const currentArrangement = { points, backEv: backHand.ev, middleEv: middleHand.ev, frontEv: bestFrontForPair.ev, backData: backHand, middleData: middleHand, frontData: bestFrontForPair };
//         if (!bestOverallArrangement || points > bestOverallArrangement.points) {
//           bestOverallArrangement = currentArrangement;
//         } else if (points === bestOverallArrangement.points) {
//           const frontComp = compareHands(currentArrangement.frontEv, bestOverallArrangement.frontEv);
//           if (frontComp > 0) {
//             bestOverallArrangement = currentArrangement;
//           } else if (frontComp === 0) {
//             const midComp = compareHands(currentArrangement.middleEv, bestOverallArrangement.middleEv);
//             if (midComp > 0) {
//               bestOverallArrangement = currentArrangement;
//             } else if (midComp === 0) {
//               if (compareHands(currentArrangement.backEv, bestOverallArrangement.backEv) > 0) {
//                 bestOverallArrangement = currentArrangement;
//               }
//             }
//           }
//         }
//         const isRepeat = isRepeatFantasyland(backHand.ev, middleHand.ev, bestFrontForPair.ev);
//         if (isRepeat) {
//           if (!bestRepeatArrangement || points > bestRepeatArrangement.points) {
//             bestRepeatArrangement = currentArrangement;
//           } else if (points === bestRepeatArrangement.points) {
//             const frontComp = compareHands(currentArrangement.frontEv, bestRepeatArrangement.frontEv);
//             if (frontComp > 0) {
//               bestRepeatArrangement = currentArrangement;
//             } else if (frontComp === 0) {
//               const midComp = compareHands(currentArrangement.middleEv, bestRepeatArrangement.middleEv);
//               if (midComp > 0) {
//                 bestRepeatArrangement = currentArrangement;
//               } else if (midComp === 0) {
//                 if (compareHands(currentArrangement.backEv, bestRepeatArrangement.backEv) > 0) {
//                   bestRepeatArrangement = currentArrangement;
//                 }
//               }
//             }
//           }
//         }
//       }
//     }
//   }
//   console.log('✅ [SOLVER] Step 4 complete: Evaluated', pairCount, 'back/middle pairs,', validArrangements, 'valid arrangements in', (Date.now() - step4Start), 'ms');
  
//   if (!bestOverallArrangement) {
//     console.log('❌ [SOLVER] No valid arrangement found!');
//     return { best: null };
//   }
  
//   console.log('⏱️  [SOLVER] Step 5: Final selection and formatting...');
//   const step5Start = Date.now();
//   const overallScore = bestOverallArrangement.points;
//   const repeatEVScore = bestRepeatArrangement ? bestRepeatArrangement.points + 8.25 : -1;
//   let finalChoice = bestOverallArrangement;
//   let isRepeatChoice = false;
//   let finalPoints = overallScore;
//   if (repeatEVScore > overallScore) {
//     finalChoice = bestRepeatArrangement;
//     isRepeatChoice = true;
//     finalPoints = repeatEVScore;
//   }
//   const finalUsedIndices = new Set([...finalChoice.backData.indices, ...finalChoice.middleData.indices, ...finalChoice.frontData.indices]);
//   const discardIndices = allCardIndices.filter(i => !finalUsedIndices.has(i));

//   const sortByRankDesc = (cards) =>
//     [...cards].sort((a, b) => b.rank - a.rank).map((c) => c.str);

//   const bestResult = { 
//     points: finalChoice.points,
//     finalEV: finalPoints,
//     isRepeat: isRepeatChoice,
//     discards: sortByRankDesc(discardIndices.map((i) => parsedCards[i])),
//     front: sortByRankDesc(finalChoice.frontData.hand),
//     middle: sortByRankDesc(finalChoice.middleData.hand),
//     back: sortByRankDesc(finalChoice.backData.hand)
//   };
  
//   console.log('✅ [SOLVER] Step 5 complete in', (Date.now() - step5Start), 'ms');
//   console.log('🎉 [SOLVER] TOTAL SOLVER TIME:', (Date.now() - solverStartTime), 'ms');
//   console.log('📊 [SOLVER] Best score:', bestResult.finalEV, 'points', isRepeatChoice ? '(Repeat FL)' : '');

//   return { best: bestResult };
// }

// module.exports = { solveOptimizedV2, parseCard };


// gemini edit to optimize speed for slow hands
// src/solver/solver.js

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["♠️", "❤️", "🔷", "🟢"];
const SUIT_MAP = { "♠️": 0, "❤️": 1, "🔷": 2, "🟢": 3, S: 0, H: 1, D: 2, C: 3 };

function parseCard(code) {
  if (!code || code.length < 2) return null;
  const c = code.trim().toUpperCase();
  const r = c[0];
  const sRaw = c.slice(1);
  const rank = RANKS.indexOf(r);
  const suit = SUIT_MAP[sRaw];
  if (rank === -1 || suit === undefined) return null;
  return { rank, suit, str: r + SUITS[suit] };
}

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

// This version of combinations works on an array of items directly
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

function solveOptimizedV2(parsedCards) {
  console.log('🔍 [SOLVER] Starting solver with', parsedCards.length, 'cards');
  const solverStartTime = Date.now();
  
  const numCards = parsedCards.length;
  if (numCards < 13) throw new Error("Solver requires at least 13 cards.");
  
  let bestOverallArrangement = null;
  let bestRepeatArrangement = null;
  
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
  
  console.log('⏱️  [SOLVER] Step 2: Sorting five-card hands...');
  const step2Start = Date.now();
  fiveCardHands.sort((a, b) => compareHands(b.ev, a.ev));
  console.log('✅ [SOLVER] Step 2 complete: Sorted in', (Date.now() - step2Start), 'ms');
  
  const MAX_FRONT_ROYALTY = 22;
  
  console.log('⏱️  [SOLVER] Step 3: Main search loop (with memoization)...');
  const step3Start = Date.now();
  let pairCount = 0;
  let cacheHits = 0;
  
  // ===================================================================
  // THE REAL FIX: A "Just-in-Time" cache (Memoization)
  // ===================================================================
  const frontHandCache = new Map();

  for (let i = 0; i < fiveCardHands.length; i++) {
    const backHand = fiveCardHands[i];
    
    if (i > 0 && i % 500 === 0) {
      console.log(`   [SOLVER] Progress: ${i}/${fiveCardHands.length} back hands processed (Cache hits: ${cacheHits})`);
    }
    
    for (let j = i; j < fiveCardHands.length; j++) {
      pairCount++;
      const middleHand = fiveCardHands[j];
      const currentBestScore = bestOverallArrangement?.points ?? -1;

      if (backHand.backRoyalty + middleHand.middleRoyalty + MAX_FRONT_ROYALTY < currentBestScore) continue;
      if (!areDisjoint(backHand.indices, middleHand.indices)) continue;
      
      const usedIndices = new Set([...backHand.indices, ...middleHand.indices]);
      const remainingIndices = allCardIndices.filter((idx) => !usedIndices.has(idx));
      
      // Use a sorted string of remaining indices as the cache key
      const cacheKey = remainingIndices.join(',');

      let bestFrontForPair = null;

      if (frontHandCache.has(cacheKey)) {
          bestFrontForPair = frontHandCache.get(cacheKey);
          cacheHits++;
      } else {
          // If not in cache, calculate it the expensive way ONCE
          for (const frontIndices of combinations(remainingIndices, 3)) {
              const hand = frontIndices.map(i => parsedCards[i]);
              const ev = evalHand(hand);
              const frontData = { indices: frontIndices, hand, ev, frontRoyalty: getRoyalties(ev, "front") };

              if (!bestFrontForPair || frontData.frontRoyalty > bestFrontForPair.frontRoyalty) {
                  bestFrontForPair = frontData;
              } else if (frontData.frontRoyalty === bestFrontForPair.frontRoyalty) {
                  if (compareHands(frontData.ev, bestFrontForPair.ev) > 0) {
                      bestFrontForPair = frontData;
                  }
              }
          }
          // Store the result in the cache for next time
          frontHandCache.set(cacheKey, bestFrontForPair);
      }

      if (bestFrontForPair && compareHands(middleHand.ev, bestFrontForPair.ev) >= 0) {
        const points = backHand.backRoyalty + middleHand.middleRoyalty + bestFrontForPair.frontRoyalty;
        const currentArrangement = { points, backEv: backHand.ev, middleEv: middleHand.ev, frontEv: bestFrontForPair.ev, backData: backHand, middleData: middleHand, frontData: bestFrontForPair };
        
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
        
        const isRepeat = isRepeatFantasyland(backHand.ev, middleHand.ev, bestFrontForPair.ev);
        if (isRepeat) {
          if (!bestRepeatArrangement || points > bestRepeatArrangement.points) {
            bestRepeatArrangement = currentArrangement;
          } else if (points === bestRepeatArrangement.points) {
            const frontComp = compareHands(currentArrangement.frontEv, bestRepeatArrangement.frontEv);
            if (frontComp > 0) {
              bestRepeatArrangement = currentArrangement;
            } else if (midComp === 0) {
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
  console.log('✅ [SOLVER] Step 3 complete: Evaluated', pairCount, 'back/middle pairs in', (Date.now() - step3Start), 'ms');
  console.log('   [SOLVER] Cache stats: Final size', frontHandCache.size, '| Total hits:', cacheHits);
  
  if (!bestOverallArrangement) {
    console.log('❌ [SOLVER] No valid arrangement found!');
    return { best: null };
  }
  
  console.log('⏱️  [SOLVER] Step 4: Final selection and formatting...');
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

  const bestResult = { 
    points: finalChoice.points,
    finalEV: finalPoints,
    isRepeat: isRepeatChoice,
    discards: sortByRankDesc(discardIndices.map((i) => parsedCards[i])),
    front: sortByRankDesc(finalChoice.frontData.hand),
    middle: sortByRankDesc(finalChoice.middleData.hand),
    back: sortByRankDesc(finalChoice.backData.hand)
  };
  
  console.log('✅ [SOLVER] Step 4 complete in', (Date.now() - step4Start), 'ms');
  console.log('🎉 [SOLVER] TOTAL SOLVER TIME:', (Date.now() - solverStartTime), 'ms');
  console.log('📊 [SOLVER] Best score:', bestResult.finalEV, 'points', isRepeatChoice ? '(Repeat FL)' : '');

  return { best: bestResult };
}

module.exports = { solveOptimizedV2, parseCard };