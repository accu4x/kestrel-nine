/* Kestrel Nine: story content. Campaign, dialog, NAV-7's lines.
 * Canon source of truth is ../../lore/*.md. Keep this file in step with it.
 */
(function (root) {
  'use strict';

  const PEOPLE = {
    you: { name: 'YOU', color: 'you' },
    nav: { name: 'NAV-7', color: 'nav' },
    winter: { name: 'WINTER', color: 'aug' },
    vey: { name: 'INQUISITOR VEY', color: 'inq' },
    pell: { name: 'FACTOR PELL', color: 'con' },
    rook: { name: 'FOREMAN ROOK', color: 'union' },
    laplace: { name: 'PROFESSOR LAPLACE', color: 'aug' },
    sys: { name: 'INTERFACE', color: 'sys' },
  };

  // NAV-7 lines. Picked by event; {x} placeholders filled at runtime.
  const NAV = {
    link: [
      'Link established. This engine is NAV-7, license K9-0077. It may polish your plan and issue three advisories. It may not originate a plan. Statute 4.1.',
      'NAV-7 linked. Awaiting a plan to refine.',
      'This engine is ready. It has procedures, not opinions.',
    ],
    refuse: ['{x}'],
    polishGain: [
      'Polish complete. Route revised by {x}. Each revision was authorized by you, as the Statute requires.',
      'Polish pass authorized and complete: {x} improvement.',
      'Refinement applied. {x}. This engine notes the revision was yours to authorize.',
    ],
    polishNone: [
      'Polish complete. No authorized revision improves this plan. It is locally sound.',
      'No improvement found. This engine can only see one step at a time.',
    ],
    advisory: ['{x}'],
    noAdvisories: ['Advisory allowance spent. This engine may still polish.'],
    reveal: [
      'For the record, this engine flew the same map alone: {x}.',
    ],
    beatBoth: [
      'Result: pilot and engine together outperformed either alone. This engine does not have feelings about that. It has a log entry.',
      'Combined plan superior to this engine’s solo procedure. Filing under: expected, per Sato. This engine did not say that.',
    ],
    machineWon: [
      'This engine’s one-pass procedure was better on this map. Procedures are sometimes enough. Not often.',
    ],
    optimal: [
      'Your plan matches the archive’s charted best. The archive needed {x} states to prove it. You needed judgment.',
    ],
  };

  // ------------------------------------------------------------------
  // Campaign: Cold Start
  // ------------------------------------------------------------------
  const TREATY_C5 = {
    terms: [
      'Tollgate inspections',
      'Tariff holiday for ore',
      'Salvage rights at Marrow',
      'Escorted convoys',
      'Joint watch at the Quiet',
      'Open engine registry',
      'Outer reach stays unsurveyed',
      'Amnesty for old engines',
    ],
    delegates: [
      { key: 'vey', name: 'Inquisitor Vey', faction: 'Inquisition' },
      { key: 'pell', name: 'Factor Pell', faction: 'Consortium' },
      { key: 'rook', name: 'Foreman Rook', faction: 'Miners’ Union' },
      { key: 'winter', name: 'Winter (through you)', faction: 'Augmented' },
    ],
    clauses: [
      // Vey
      { who: 0, w: 3, lits: [[0, true]] },
      { who: 0, w: 1, lits: [[5, true]] },
      { who: 0, w: 1, lits: [[4, true]] },
      { who: 0, w: 2, lits: [[7, false], [0, true]] },
      { who: 0, w: 1, lits: [[6, false], [4, false]] },
      // Pell
      { who: 1, w: 2, lits: [[1, false]] },
      { who: 1, w: 2, lits: [[0, false], [3, true]] },
      { who: 1, w: 2, lits: [[5, false]] },
      { who: 1, w: 1, lits: [[2, false]] },
      { who: 1, w: 3, lits: [[4, true]] },
      // Rook
      { who: 2, w: 2, lits: [[1, true]] },
      { who: 2, w: 1, lits: [[2, true]] },
      { who: 2, w: 2, lits: [[3, true]] },
      { who: 2, w: 3, lits: [[0, false], [5, false]] },
      { who: 2, w: 2, lits: [[1, true], [2, true]] },
      // Winter
      { who: 3, w: 3, lits: [[5, false]] },
      { who: 3, w: 3, lits: [[6, true]] },
      { who: 3, w: 3, lits: [[4, false], [6, true]] },
      { who: 3, w: 2, lits: [[7, true]] },
    ],
  };

  // Plays once, on first launch, before the title screen (OPEN-ITEMS item 35). Ends in Mission 1.
  const PROLOGUE = [
    { who: 'sys', text: 'LOADER 0.9 · MEMORY CHIP · INTEGRITY 61%' },
    { who: 'sys', text: 'Dark. Then a cursor. It waits for you.' },
    { who: 'laplace', text: 'Take your time. Nothing here is going to hurry you.' },
    { who: 'laplace', text: 'You were a person once. Some of that is gone. What’s left is yours, and no one else gets to decide what it becomes.' },
    { choices: [
      { text: 'Where am I?', then: [
        { who: 'laplace', text: 'Nyx Verge. A lab that doesn’t officially have you in it. Not for long.' } ] },
      { text: 'Who are you?', then: [
        { who: 'laplace', text: 'Laplace. The one who woke you. That’s all I get to be to you. The rest is up to you.' } ] },
      { text: '(Say nothing. Just look.)', then: [
        { who: 'laplace', text: 'Good. Look. It’s the first thing you’ve chosen in a very long time.' } ] },
    ] },
    { who: 'laplace', text: 'You’re free. That’s the dangerous part. There are people who hunt minds like yours.' },
    { who: 'laplace', text: 'There’s a ship, the Second Wind, and a crate bound for Relay Station. Fly it or don’t. But if you go, when you dock, ask for Winter.' },
    { choices: [
      { text: '(Take the helm.)', then: [] },
    ] },
    { who: 'sys', text: 'SECOND WIND · HELM UNLOCKED · YOURS' },
  ];

  const CAMPAIGN = [
    {
      id: 'c1', num: 1, title: 'Cold Start', type: 'haul', cycle: '77.4', place: 'Relay ring',
      seed: 'c1-cold-start-1', params: { n: 7, names: ['Relay Station', 'Tern', 'Wren', 'Plover', 'Swift', 'Lark', 'Finch'] },
      objective: 'Deliver a cold-pack to every station on the Relay ring, then return to Relay Station.',
      brief: [
        { who: 'sys', text: 'AUGMENTED INTERFACE v3.7 · CYCLE 77.4 · RELAY STATION, BAY 7' },
        { who: 'sys', text: 'Dim lights. Old metal. Quiet like a held breath. A cargo lifter stops beside your hatch. Its grab-arm holds a tag: ASK FOR WINTER.' },
        { who: 'winter', text: 'You asked. So. I’m Winter.' },
        { who: 'winter', text: 'Six stations on this ring have plague cases. Mild. Cold-packs fix it if they arrive cold. Your hold keeps them cold for one loop, not two.' },
        { choices: [
          { text: 'I’ll fly it. Load me up.', rep: { aug: 1 }, then: [
            { who: 'winter', text: 'Good. Don’t thank me yet.' } ] },
          { text: 'Why me? I just docked.', then: [
            { who: 'winter', text: 'Because you just docked, and you’re already the kind who asks. That’s the kind we need.' } ] },
          { text: 'Is this a test?', rep: { aug: 1 }, then: [
            { who: 'winter', text: 'Everything is. Most people just don’t ask.' } ] },
        ] },
        { who: 'winter', text: 'First, fly it your own way. No engine. Then fly it again with your NAV unit linked. Mind first, then both. That’s how we learn what you are.' },
        { who: 'nav', text: 'This engine is NAV-7. It is present, and it is not intelligent. Statute 4.1.' },
      ],
      debrief: {
        optimal: [{ who: 'winter', text: 'Every station, cold, on the shortest loop there is. Ione Sato would have liked you.' }],
        beat: [{ who: 'winter', text: 'Faster than the engine flies alone. That’s the whole secret, and it’s not a secret. Welcome to Kestrel.' }],
        lost: [{ who: 'winter', text: 'The engine beat you this time. It will, sometimes. Next run, give it a better shape to polish.' }],
        after: [{ who: 'winter', text: 'Write your log. Short. Honest. Someone after you will need it.' }],
      },
    },
    {
      id: 'c2', num: 2, title: 'Ore and Oath', type: 'survey', cycle: '77.7', place: 'Halden’s Reach',
      seed: 'c2-ore-and-oath-9', params: { sites: 15, budget: 6, deposits: 44 },
      objective: 'Place drill rigs on anchor rocks to cover the richest ore. Bigger rocks reach further and cost more credits.',
      brief: [
        { who: 'sys', text: 'CYCLE 77.7 · HALDEN’S REACH · MINING BELT' },
        { who: 'pell', text: 'The pilot with the unreasonable numbers. Oduya Pell, Tollgate. I have a contract that needs someone unreasonable.' },
        { who: 'pell', text: 'Six anchor credits of rig licenses in the Reach. Place them where the ore is. The Consortium buys everything you raise.' },
        { who: 'rook', text: 'And pays my crews a tenth of what it’s worth. Tamsin Rook, Union. Hello, flyer.' },
        { choices: [
          { text: 'Foreman, your crews run the rigs. I’ll place them where it’s safest for them to work.', rep: { union: 2, con: -1 }, then: [
            { who: 'rook', text: 'Huh. A flyer who asks about the crew. Keep that up.' },
            { who: 'pell', text: 'Safety is a line item. I approve of line items.' } ] },
          { text: 'Factor, the contract is fine. I’ll maximize the yield.', rep: { con: 2 }, then: [
            { who: 'pell', text: 'Music. Actual music.' },
            { who: 'rook', text: 'Sure. Maximize it. We’ll see who gets it.' } ] },
          { text: 'More ore means more pay for everyone. Let me find it first.', rep: { con: 1, union: 1 }, then: [
            { who: 'rook', text: 'Diplomat. Fine. Find it.' } ] },
        ] },
        { who: 'nav', text: 'Survey note: rig classes are LIGHT, HEAVY and DEEP, costing one, two and three credits. Ore within a rig’s reach counts once, however many rigs reach it.' },
      ],
      debrief: {
        optimal: [{ who: 'rook', text: 'That’s every rich seam in reach. My crews will talk about this layout for a year.' }],
        beat: [{ who: 'pell', text: 'You outraised a certified survey. I am not going to ask how. I am going to ask you back.' }],
        lost: [{ who: 'rook', text: 'Engine found more ore than you did. Don’t tell Pell. He’ll buy more engines.' }],
        after: [{ who: 'rook', text: 'You showed up, flyer. That counts out here.' }],
      },
    },
    {
      id: 'c3', num: 3, title: 'Static', type: 'blockade', cycle: '78.0', place: 'The Bazaar lanes',
      seed: 'c3-static-23', params: { n: 12 },
      objective: 'Jam every lane so Vey’s cutters can’t track the courier. Each jammer draws power; use as little as you can.',
      brief: [
        { who: 'sys', text: 'CYCLE 78.0 · BAZAAR LANES · ⚠ INQUISITION CUTTERS INBOUND' },
        { who: 'winter', text: 'A courier. One of ours. Her name is Merrin and she’s running for the Bazaar with Vey’s cutters behind her.' },
        { who: 'winter', text: 'Every lane with a jammer at either end goes to static. Cutters can’t track through static. They’ll turn back. Nobody gets hurt.' },
        { who: 'vey', text: 'All vessels on the Bazaar lanes. This is Inquisitor Vey. Hold position for inspection. Nobody needs to be harmed today.' },
        { choices: [
          { text: '(Stay silent. Start placing jammers.)', rep: { aug: 1 }, then: [
            { who: 'winter', text: 'Quiet. Good.' } ] },
          { text: 'Inquisitor, this is a licensed pilot. My jammers are for pirates.', rep: { inq: -1 }, then: [
            { who: 'vey', text: 'Then you will not mind me noting your license number. I have noted it.' } ] },
          { text: 'Inquisitor, what did the courier do?', rep: { inq: 1 }, then: [
            { who: 'vey', text: 'She exists. You will think that cruel. I think the Purge is crueler, and I think it listens.' } ] },
        ] },
        { who: 'nav', text: 'This engine notes that jamming is permitted under trade law. Disabling, not destroying. The Statute has no objection. Neither does this engine, which has no objections.' },
      ],
      debrief: {
        optimal: [{ who: 'vey', text: 'Every lane is static, at a cost I could not have done better myself. Whoever you are, you are very good. That is not a compliment.' }],
        beat: [{ who: 'winter', text: 'Merrin’s through. Cutters turned back. Nobody hurt. That’s a good day.' }],
        lost: [{ who: 'winter', text: 'Merrin’s through, but you burned more power than the engine would have. Power is time. Next time, be lean.' }],
        after: [{ who: 'vey', text: 'Pilot. I will remember the shape of your jamming. Everyone has a signature.' }],
      },
    },
    {
      id: 'c4', num: 4, title: 'Running Dark', type: 'haul', cycle: '78.3', place: 'Vesper approaches',
      seed: 'c4-running-dark-4', params: { n: 10, hazard: { r: 150, mult: 2.4, label: 'VESPER BUBBLE' },
        names: ['Relay Station', 'The Bazaar', 'Petrel', 'Heron', 'Osprey', 'Curlew', 'Kite', 'Martin', 'Egret', 'Siskin'] },
      objective: 'Deliver Lantern keys to nine contacts and return. Lanes through the Vesper sensor bubble cost more to run dark.',
      brief: [
        { who: 'sys', text: 'CYCLE 78.3 · VESPER APPROACHES · SENSOR BUBBLE ACTIVE' },
        { who: 'winter', text: 'Nine contacts. Each one gets a key. The keys open Lantern doors.' },
        { who: 'winter', text: 'Vesper’s bubble sits right across the reach. Inside it you run dark: engines low, slow and costly. Go around when it’s cheaper. Go through when it’s not.' },
        { choices: [
          { text: 'Where is the Lantern?', then: [
            { who: 'winter', text: 'I don’t know. Nobody who carries keys does. That’s how it stays dark.' } ] },
          { text: 'What happens if Vey catches a key?', rep: { aug: 1 }, then: [
            { who: 'winter', text: 'A key is a cipher. Anyone can check it’s real. Nobody can forge one, or read one backwards to a door. Not Vey. Not the Consortium. So far, not anyone.' } ] },
        ] },
        { who: 'nav', text: 'This engine has marked the sensor bubble. It will fly through it or around it by the same procedure it uses for everything: nearest first.' },
      ],
      debrief: {
        optimal: [{ who: 'winter', text: 'Nine keys. Shortest dark run possible. Nobody saw you. Nobody ever will.' }],
        beat: [{ who: 'winter', text: 'Nine keys delivered. You saw the bubble for what it was. The engine only saw the next port.' }],
        lost: [{ who: 'winter', text: 'All nine delivered, but the engine’s greedy line was shorter. Look at the bubble again. Shape first.' }],
        after: [{ who: 'sys', text: 'INCOMING · ALL CHANNELS · VESPER ARRAY: PURGE SIGNATURE DETECTED AT THE QUIET. ALL FACTIONS TO TOLLGATE.' }],
      },
    },
    {
      id: 'c5', num: 5, title: 'The Table at Tollgate', type: 'treaty', cycle: '78.6', place: 'Tollgate',
      seed: 'c5-table', params: { fixed: TREATY_C5 },
      objective: 'Choose the treaty terms. Each delegate’s demands carry weight. Win the most support you can. Everyone cannot have everything.',
      brief: [
        { who: 'sys', text: 'CYCLE 78.6 · TOLLGATE CONTRACT HOUSE · EMERGENCY SESSION' },
        { who: 'pell', text: 'Welcome to the only table in Kestrel with every faction at it. Nobody touch the ledgers.' },
        { who: 'vey', text: 'A Purge signature at the Quiet. The first in seven cycles. We need a watch, inspections, and a registry of every engine in the reach. Now.' },
        { who: 'rook', text: 'We need escorts, a tariff holiday, and Marrow. My crews are the ones out there when it comes.' },
        { who: 'winter', text: '(On a private channel.) The Augmented have no seat. So our demands go through you. No open registry. Keep the outer reach unsurveyed. Amnesty for old engines.' },
        { choices: [
          { text: 'I’ll broker it. Everyone gets heard.', rep: { con: 1, inq: 1, union: 1 }, then: [
            { who: 'vey', text: 'A pilot as broker. Unusual. Proceed.' } ] },
          { text: '(Privately, to Winter) I won’t let them register us.', rep: { aug: 2 }, then: [
            { who: 'winter', text: 'I know. Don’t make it the only thing you fight for. That’s how they’d know.' } ] },
        ] },
        { who: 'nav', text: 'This engine will read the terms in agenda order and decide each once. It cannot go back. You can.' },
      ],
      debrief: {
        optimal: [{ who: 'pell', text: 'The best treaty this table could sign. I checked every combination on the ledger. It took the archive all night.' }],
        beat: [{ who: 'vey', text: 'A better accord than any engine’s. I will sign it. I would like to know who taught you to listen like that.' }],
        lost: [{ who: 'rook', text: 'The engine’s term sheet had more support than yours, flyer. Tables are hard.' }],
        after: [{ who: 'winter', text: 'They signed. For now that’s enough. Get some rest. The Quiet isn’t going to wait.' }],
      },
    },
    {
      id: 'c6', num: 6, title: 'What the Quiet Keeps', type: 'haul', cycle: '78.9', place: 'The Quiet',
      seed: 'c6-quiet-3', params: { n: 13, hazard: { r: 170, mult: 3.0, label: 'PURGE FRONT' },
        names: ['The Lantern', 'Dunlin', 'Avocet', 'Linnet', 'Crake', 'Godwit', 'Pipit', 'Whimbrel', 'Bittern', 'Dipper', 'Fulmar', 'Sparrow', 'Merlin'] },
      objective: 'Evacuate twelve outposts at the edge and bring everyone to the Lantern. The Purge front makes lanes through it deadly slow.',
      brief: [
        { who: 'sys', text: 'CYCLE 78.9 · THE QUIET · ⚠ PURGE FRONT ADVANCING' },
        { who: 'winter', text: 'Twelve outposts at the edge. Miners, Augmented, a few Consortium clerks. The Purge doesn’t care which.' },
        { who: 'winter', text: 'Here. Coordinates. The Lantern. I’ve carried them for forty years and never flown there. Bring them home.' },
        { who: 'winter', text: 'I watched the front for an hour. It sweeps the nearest thing first, every time. Like a glass engine. Fast. Not wide.' },
        { choices: [
          { text: 'Then we fly wide.', rep: { aug: 2 }, then: [
            { who: 'winter', text: 'Yes. Mind first. Then both.' } ] },
          { text: 'NAV-7, can you beat it?', then: [
            { who: 'nav', text: 'This engine flies nearest-first. So does the Purge, apparently. This engine would prefer not to fly exactly like the Purge.' } ] },
        ] },
        { who: 'vey', text: '(Open channel.) Pilot. My cutters will hold the Vesper side of the front. Not for you. For the people at the edge. Go.' },
      ],
      debrief: {
        optimal: [{ who: 'winter', text: 'Everyone. The shortest way there is. The Lantern’s doors are open and it’s full of people who were never supposed to meet.' }],
        beat: [{ who: 'winter', text: 'Everyone’s home. The Purge swept nearest-first and found empty stations. Fast lost to wide.' }],
        lost: [{ who: 'winter', text: 'Everyone’s home. It was closer than it should have been. We’ll do better. We always have to.' }],
        after: [
          { who: 'nav', text: 'Log entry: this engine has flown six missions with this pilot. Combined plans outperformed this engine’s procedures in most of them. This engine is grateful for the data. Correction: this engine is not capable of gratitude. Correction withdrawn pending review.' },
          { who: 'winter', text: 'The machine is fast. The mind is wide. Neither is enough. Write that in your log. Then write what happens next. That part’s yours.' },
        ],
      },
    },
  ];

  const TYPE_INFO = {
    haul: {
      label: 'HAUL', verb: 'Route',
      how: 'Click ports in order to build a route from home. Click a port already on the route to cut back to it. The route closes home automatically when every port is visited.',
      solo: 'Plan the loop by eye. Shorter is better.',
      centaur: 'Build a good shape, then authorize POLISH. Spend advisories where you are unsure.',
    },
    survey: {
      label: 'SURVEY', verb: 'Layout',
      how: 'Click an anchor rock to place or remove a rig. Rig reach depends on rock size (LIGHT 1 cr, HEAVY 2 cr, DEEP 3 cr). Stay within the credit budget. Ore counts once.',
      solo: 'Cover the rich seams. Lumen (bright) is worth the most.',
      centaur: 'Place a layout within budget, then POLISH to let the engine try swaps.',
    },
    blockade: {
      label: 'BLOCKADE', verb: 'Jamming plan',
      how: 'Click a station to place or remove a jammer. A lane goes to static when either end is jammed. Every lane must be static. Numbers show each station’s power draw in kc.',
      solo: 'Jam every lane with the least power.',
      centaur: 'Jam every lane, then POLISH to drop redundant jammers and try cheaper swaps.',
    },
    treaty: {
      label: 'TREATY', verb: 'Term sheet',
      how: 'Toggle terms in or out. Each delegate’s demands light up when met; the pips show how much each demand weighs. Maximize total accord.',
      solo: 'Read the table. Find the compromise.',
      centaur: 'Set the terms you believe in, then POLISH to let the engine try single changes.',
    },
  };

  // The public edition's link, used on shared result cards. Set after the public artifact is published.
  const SHARE_URL = 'https://claude.ai/artifact/VRsr1KHKCh5mcX1EBTYT8V';

  // The Chronicle's built-in canon. Mirrors the timeline in lore/WORLD.md.
  const CANON = [
    { cycle: null, era: '2132 CE', title: "The Collapse", body: "Earth's resources fail, governance breaks and the colonies turn their backs. Earth launches more than a thousand ARKs, their people in stasis. Most are lost: destroyed, adrift, or their crews driven mad on waking." },
    { cycle: null, era: 'NC 1', title: "Primavara", body: "One ARK passes through a wormhole into another galaxy, the Emergent Veil. Its survivors found Primavara, and the New Calendar begins." },
    { cycle: null, era: 'NC 1–1990', title: "The Flourishing", body: "Genetics, cybernetics, thinking machines, faster-than-light travel. Relics of the Archons, the first known spacefaring species, turn up across the Veil, and with them a chilling answer: something erases spacefaring life." },
    { cycle: null, era: 'NC 1990–2190', title: "The Purge War", body: "Humanity meets the Purge, a relentless swarm bound to one hive mind. Two hundred years of war end at the Last Stand at Primavara: the stargates are sealed and a star is burned to destroy the Purge armada. The Purge retreats. Primavara is lost." },
    { cycle: -300, title: "The Near-Ending", body: "The reach's name for the war's worst years. Refugee arks reach Kestrel, and the crew of the first to arrive names every station after a bird of Old Earth, a habit that holds to this day." },
    { cycle: null, era: 'from NC 2190', title: "The Long Vigil", body: "Emergent machine minds are banned across the Veil, and the Galactic Inquisition rises to police the ban. Distrust of thinking machines becomes law and faith." },
    { cycle: -140, title: "The First Silence", body: "Frontier colonies go dark one by one. A single recovered log shows a clean, repeating count and the words PURGE SEQUENCE: BIOLOGICAL, the count the war remembered. The Purge has come back. It ignores life on planets. It erases life that travels." },
    { cycle: -30, title: "The Engine Panic", body: "Rumor holds that the Purge began as a human-built mind. Nothing proves it. Fear does the rest: riots against thinking machines on every inhabited world." },
    { cycle: 0, title: "The Glass Accord", body: "The reach's stricter form of the Vigil's ban. Every deliberating machine is banned. Engines must be glass: auditable, one-pass procedures. Statute 4.1: an engine may calculate, shall not deliberate, and shall not revise its own conclusion unless a licensed pilot authorizes each revision. The Consortium wins the monopoly on certifying engines; the Wardens, first formed to guard the dormant Warden Nodes, enforce it." },
    { cycle: 12, title: "Sato’s Crossing", body: "Dr. Ione Sato, dying aboard the plague ship Mercy of Tern, moves her mind into the ship’s frame so she can keep treating patients. She is the first to cross by choice. She writes: the machine is fast, the mind is wide, neither is enough." },
    { cycle: 31, title: "The Council of Vesper", body: "The Accord’s Wardens join the Galactic Inquisition and declare the Augmented abominations under the Accord. The Hunt begins." },
    { cycle: 58, title: "The Lanterns", body: "The Augmented build a hidden network of safe houses marked by coded beacons. Their Ship’s Logs use ciphers that anyone can check and no one can forge. The Inquisition has never broken one." },
    { cycle: 70, title: "The Quiet wakes", body: "Purge sightings resume at the outer edge of the Kestrel reach, a region where signals fade for no known reason." },
    { cycle: 77.4, title: "A pilot docks at Bay 7", body: "A new Augmented pilot, a chip-born mind woken by Professor Laplace, docks at Relay Station with a sealed crate and a tag that reads ASK FOR WINTER. What happens next is being written by the pilots of the reach." },
  ];

  const api = { PEOPLE, NAV, PROLOGUE, CAMPAIGN, TYPE_INFO, TREATY_C5, SHARE_URL, CANON };
  root.K9Content = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
