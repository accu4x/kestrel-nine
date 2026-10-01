<!-- Delete the lines that do not apply. Tick a box only for what was actually done. -->

## What changes

## Tests

Tick what was run, and say who ran it. Each line is one whole command.

- [ ] `node artifact/test/engine.test.cjs`
- [ ] `node artifact/test/save.test.cjs`
- [ ] `node artifact/test/leak.test.cjs`
- [ ] `node artifact/build.mjs --site`
- [ ] `node artifact/test/leak.test.cjs --dir artifact/dist/site` (needs the site build)
- [ ] `python artifact/test/smoke_site.py` (needs the site build)

## Before Dan merges

- [ ] **Review it running.** What to open, and what to look for:
- [ ] **Game text.** No problem names. New or changed dialog and lore reviewed like canon (`lore/CANON.md`).
- [ ] **Nothing private.** No handover file and nothing from the private design context.
- [ ] **Copilot review** requested, and its findings answered.

## After the merge

- [ ] Republish the home edition (keeps `db` and `user`, and the canon write rule).
- [ ] Republish the public edition (no capabilities).
- [ ] Deploy the site edition: `npx wrangler deploy`
- [ ] `OPEN-ITEMS.md` updated with the date and the commit.
