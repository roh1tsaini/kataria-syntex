# rules.md (v1, 3 oct 2026)

what this file is: business logic, calculations, numbering and edge cases, one small line per point.
screens, fields, data and tech live in spec.md.
to add a topic: copy the template at the bottom. to remove one: delete its block.
lines in "to confirm" are my ideas that you have not approved yet.

## core rules

- stock changes only through entries (receive, send, return, process, split, merge, reject, adjust, change owner)
- stock is never edited directly
- history is never overwritten, edits log who, when and the old value
- only admin edits saved entries, packer can only add
- kg is the master unit, cones is a softer count
- no prices or accounting, schema stays open for it later
- no offline mode, a failed save keeps the entry on screen to retry

## owner and holder

- owner: one of my companies or a customer
- holder: my factory, a job worker, or in transit
- supplier and owner are different things (supplier delivers, owner owns)
- customer-owned yarn is job work only: processed and returned, not sold by us
- "change owner" is an action with history (customer sells leftover yarn to us)
- stock views filter by owner: one company, all companies, one customer

## calculations

- less = (cones x tube wt) + (boxes x box wt) + (bags x bag wt)
- nett = gross - less
- challan totals = sum of rows, never typed
- gain/loss % = (kg back - kg sent) / kg sent x 100
- dye batches = cones sent / worker capacity, last batch may be partial (320 / 80 = 4)
- pending days = today - send date
- tare weights are copied into each entry, so later weight changes never alter old entries

## stage rules

- raw and soft: kg only, cones not matched (one big cone becomes many)
- send to job worker: kg and cones both required
- receive back: cones and kg optional, "received in full" is one tap
- final coning: cone count is flexible, may be higher, lower or merged, no error
- packing: all details recorded (lot, color, denier, box, gross, tare, cones)

## lot numbers

- one running number per company, auto, never typed, never reused, gaps fine
- every new batch takes the next number
- a send of 320 cones at capacity 80 returns 4 dyed batches, each with its own lot and color
- supplier lot is a separate field, kept on raw material
- merge asks "keep main lot or make a new lot", default is the bigger lot
- a small top-up (a few cones) keeps the main lot and records the source

## box numbers

- one global running number, unique, auto when the packer saves
- gaps are fine (real challans already skip numbers)
- deleted box leaves a void gap, number never reused
- packer writes it on the cardboard, same number on sticker and challan
- challan "sr no" is separate and counts rows 1, 2, 3 inside each challan
- a box with leftover cones from two lots: same box no on two lines, one per lot
- partial boxes are normal, less wt follows cones

## challan numbers

- per company, per series code (JW1, DC1, RT1), continuous
- max 16 characters including the code, letters, numbers, dash and slash allowed
- optional reset each financial year, off by default
- cancelled challan stays as "cancelled", number never reused, stock effect reversed
- issued challan is locked, admin edits with a reason
- required fields to check with your ca: date, number, both parties with gstin if registered, hsn and description, quantity, vehicle, copies in triplicate

## job worker rules

- each worker has capacity (cones per dye batch), pending alert days, kg basis
- kg basis: their kg includes tubes yes, no or not sure
- not sure: gain/loss compares as is and is labeled "basis unknown"
- send not a multiple of capacity: warn, suggest topping up with other soft cones or reject stock
- return color different from plan: flag, do not block
- return cones or kg different from sent: show the difference, do not block
- their lot no is usually blank: match returns by worker and open send-out
- partial returns allowed, the rest stays pending
- "in-house" is a built-in worker with its own capacity, no challan needed

## weight changes (normal, not errors)

- oil added to yarn raises weight
- moisture after dyeing raises weight
- gain/loss report shows a normal range per worker, only odd batches are flagged
- tubes are about 6% of gross weight on a sample challan, so never mix gross and net

## merge and split

- split: one batch into many (400 kg raw, 100 kg sent, 300 stays)
- merge: many into one (80 + 20 soft cones to fill 100 for a dye batch)
- merging different color, shade or denier: warn, allow with confirm
- merging different supplier lots: warn (suppliers print "do not mix lots")
- every split and merge links parent to child, share kept (70% lot a, 30% lot b)
- tracing is per batch, not per cone

## reject loop

- reject at final coning: count and reason (color, damage, other), weight comes later
- reject stock is grouped by denier and remembers its old color
- re-soft: rewind onto pvc, weigh in kg, new lot, same owner, marked "re-dye"
- then sacks, job worker, dyed, final coning like any batch
- dark colors are flagged, dark dye batches suggest reject stock of the same denier

## orders

- order: party, color, kg, denier/quality, due date, notes
- on create: check stock, show what is missing, reserve matching stock
- reserved stock cannot be claimed by another order
- status comes from linked batches, progress in kg
- partial delivery allowed (95 of 100 kg)
- order change or cancel releases reserved stock
- rejected cones can be reused for another order (black case)
- order due date near triggers an alert

## permissions

- admin: everything, invites users, edits, makes challans, sees all companies
- packer: packing screen only, add only
- challan permission can be given to other users by admin
- anything saved is edited by admin only
- audit log: who, when, action, old value, new value

## alerts

- yarn pending longer than the worker's limit
- order due in n days
- delivered to admin's telegram bot and an in-app badge
- a daily check runs them

## monthly stock check

- expected stock listed by lot, tick matches, type counts only where different
- a difference becomes an adjustment with a reason
- adjustment is its own entry, never overwrites history
- last counted date per lot

## scan rules

- order: on-device ocr + label matching, then workers ai free tier, then manual
- math check: gross - less = nett and row sums vs printed totals
- mismatch: flag the row, never save silently
- handwritten challans are typed by hand
- raw material keeps totals only, box rows only used for the check
- multi page challans: page 2 totals are running totals, do not double count

## free tier rules

- d1 free: 5m row reads and 100k row writes per day, resets daily, queries fail once passed
- workers free: 100k requests per day, 10 ms cpu per request
- every query uses an index, reports are paginated, no repeated full scans on dashboards
- pdf, excel and sticker sheets are made on the device
- rough load: 4 to 10 users, 20 to 50 challans a day, well inside the limits (estimate)
- sms is capped per month, email otp and telegram carry the rest

## edge cases

- one big raw cone becomes 2, 3 or 4 soft cones: cone count never forced to match at raw
- dyed 80 cones come back as 85 or 79: accepted, noted, no error
- two cones wound into one: same as above
- rejected cones kept for a later black order: reject stock
- box left with 10 cones: packed next time mixed with another lot, two lines on the challan
- same color from two lots: separate batches, separate lots, box numbers still global
- job worker sends kg but no cones: fine, cones optional
- job worker challan has no lot no: match by worker and open send-out
- same color name from different parties: stays separate
- supplier challan spans 2 pages with running totals: read totals once
- bill-to party differs from deliver-at location: challan has both
- raw sold directly: delivery challan of raw kg, owner must be my company
- packer slip-up: admin fixes it, logged
- network drops mid save: entry stays on screen, tap save again
- new color needed while making an order or challan: add by name, fill later
- deleted box: void gap, number not reused
- cancelled challan: number stays, stock returns

## to confirm

- no machine tracking at any stage
- lot number assigned when soft yarn is sacked
- suggested start kg for an order = order kg / (1 + typical gain %)
- hsn code on job work challans (ask your ca)
- per worker: is their kg net or gross

## future topics (blank, fill when ready)

## sticker rules

- what goes on it:
- when it prints:
- rule:
- open:

## other challan types

- type name:
- stock effect:
- numbering:
- rule:
- open:

## prices and billing (not now)

- what is priced:
- calculation:
- rule:
- open:

## template (copy for a new topic)

## topic name

- rule:
- formula:
- edge case:
- open:
