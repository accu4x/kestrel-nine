---
title: Missions
status: canon (story) + design notes
updated: 2026-09-28
---

# Missions

## How every mission is played

1. **Solo.** The pilot solves it alone. No engine help.
2. **Centaur.** The same map again, with NAV-7 linked. The pilot may start from the solo answer
   or from scratch, spend up to **three advisories**, and authorize **polish** passes.
3. **Debrief.** NAV-7's own run (one pass, no revisions, per Statute 4.1) is revealed beside
   yours, with the **charted best**: the Consortium archive's answer, computed by exhaustive
   survey where the map is small enough, otherwise the best route anyone has found.

The Records keep all three results for every run. The **Centaur Index** is the share of runs
where pilot-plus-engine beat both the engine alone and the pilot alone.

## Mission types

Designer notes only: the in-game text never names the underlying problems.

| Type | In-game job | Underlying problem | NAV-7 alone | Polish | Charted best |
|---|---|---|---|---|---|
| **Haul** | Deliver to every port and return home. | Traveling salesman (asymmetric costs near sensor bubbles) | Nearest-first | 2-opt + or-opt to local optimum | Held–Karp, up to 15 stops |
| **Survey** | Place K drill rigs to cover the richest deposits. | Maximum coverage | Greedy by marginal yield | Single-swap local search | Exhaustive over site combinations |
| **Blockade** | Jam every lane so an Inquisition wing cannot track a courier. Minimize power. | Minimum weighted vertex cover | Greedy by lanes-per-kc, no pruning | Drop redundant jammers, swap a jammer for its neighbours | Branch and bound |
| **Treaty** | Choose treaty terms that win the most weighted support from the delegates. | Weighted MAX-2-SAT | One pass, term by term | Single-flip local search | Exhaustive over term sets |
| Trade *(backlog)* | Buy and sell across ports with a limited hold and fuel. | Prize-collecting routing + knapsack | — | — | — |

Why these procedures: each "NAV-7 alone" rule is a real, published one-pass heuristic. It is
decent and it is beatable. Polish is real local search, and it gets stuck in local optima. A
pilot's job in centaur mode is to give the engine a good shape to polish, and to spend the
three advisories where judgment is weakest.

## Campaign: *Cold Start* (six missions, Cycle 77.4 – 78.9)

| # | Title | Type | Setting | Contact | Story beat |
|---|---|---|---|---|---|
| 1 | **Cold Start** | Haul, 7 stops | Relay ring | Laplace, Winter | Prologue: at Nyx Verge, Professor Laplace wakes your mind and sets you free; "ask for Winter". You arrive with a sealed crate. Winter asks you to deliver sealed medical cold-packs to every station on the Relay ring and come back. It is a test. |
| 2 | **Ore and Oath** | Survey, 3 rigs | Halden's Reach | Pell, Rook | Pell offers a clean contract. Rook wants the yield to go to her crews. You decide where the rigs go. |
| 3 | **Static** | Blockade | The Bazaar lanes | Vey | An Augmented courier is running for the Bazaar with Vey's cutters behind her. Jam every lane. Disable, never destroy. |
| 4 | **Running Dark** | Haul, 10 stops | Near the Vesper Array | Winter | Deliver Lantern keys to the network's contacts without lighting up Vesper's sensor bubble. |
| 5 | **The Table at Tollgate** | Treaty | Tollgate | Vey, Pell, Rook, Winter | A Purge sighting forces the factions to one table. You broker the terms. The Augmented have no seat, so their demands travel through you. |
| 6 | **What the Quiet Keeps** | Haul, 13 stops | The Quiet | Winter, NAV-7 | The Purge is sweeping in. Evacuate every outpost at the edge. Winter notices the Purge sweeps nearest-first, like a glass engine. Fast, and not wide. |

The campaign ends with the first line of the Chronicle that players write together.

## Daily Seed and Arcade

- **Daily Seed:** one map per mission type per UTC day, the same for every player.
- **Arcade:** pick a type and a size; share the seed code to race a friend on the same map.
