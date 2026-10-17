# apps/app — business rules

What this file owns: business logic, calculations, numbering and edge cases.

- Screens, fields, data, tech, auth, limits: `spec.md`.
- Items under **Open** are not decided. Nothing in Open is built.

**Core**

- Stock changes only through entries: receive, send, return, process, split, merge, reject, adjust, change owner
- Stock is never edited directly
- History is never overwritten
- Every edit logs who, when and the old value
- Only admin edits saved entries
- Packer can only add
- kg is the master unit, cones is a softer count
- No prices or accounting, schema stays open for it
- No machine tracking at any stage
- No offline data entry: a failed save keeps the entry on screen to retry

**Owner and holder**

- Owner: one of my companies or a customer
- Holder: my factory, a job worker, or in transit
- Supplier delivers, owner owns, they are different things
- Customer-owned yarn is job work only: processed and returned, never sold by us
- "Change owner" is an action with history (a customer sells leftover yarn to us)
- Stock views filter by owner: one company, all companies, one customer

**Calculations**

- less = (cones × tube wt) + (boxes × box wt) + (bags × bag wt)
- nett = gross − less
- Challan totals = sum of rows, never typed
- gain/loss % = (kg back − kg sent) ÷ kg sent × 100
- dye batches = cones sent ÷ worker capacity, last batch may be partial (320 ÷ 80 = 4)
- pending days = today − send date
- Tare weights are copied into each entry, so a later weight change never alters old entries

**Stage rules**

- Raw and soft: kg only, cones not matched (one big cone becomes many)
- Send to job worker: kg and cones both required
- Receive back: cones and kg optional, "received in full" is one tap
- Final coning: cone count is flexible, higher, lower or merged, no error
- Packing: lot, color, denier, box no, gross, tare, cones all recorded

**Lot numbers**

- One running number per company, automatic, never typed, never reused, gaps fine
- Lot is given when raw is received
- Sacking keeps the lot
- Every other new batch takes the next number
- A send of 320 cones at capacity 80 returns 4 dyed batches, each with its own lot and color
- Supplier lot is a separate field kept on raw material
- Merge asks "keep main lot or make a new lot", default is the bigger lot
- A small top-up (a few cones) keeps the main lot and records the source
- Same color from two lots: separate batches, separate lots

**Box numbers**

- One global running number, unique, automatic when the packer saves
- Gaps are fine (real challans already skip numbers)
- A deleted box leaves a void gap, the number is never reused
- Packer writes it on the cardboard, same number on sticker and challan
- Challan "sr no" is separate and counts rows 1, 2, 3 inside each challan
- A box with leftover cones from two lots: same box no on two lines, one per lot
- Partial boxes are normal, less weight follows cones

**Challan numbers**

- Per company, per series code (JW1, DC1, RT1), continuous
- Maximum 16 characters including the code
- Allowed: letters, numbers, dash, slash
- Optional reset each financial year, off by default
- A cancelled challan stays as "cancelled", number never reused, stock effect reversed
- An issued challan is locked, admin edits with a reason

**Selling**

- Delivery challan rows are packed boxes, or kg from a lot at any stage
- Owner must be my company
- Stock drops when the challan is made
- A delivery challan carries both bill-to party and deliver-at location

**Job workers**

- Each worker has capacity (cones per dye batch), pending alert days, kg basis
- kg basis: their kg includes tubes yes, no or not sure
- Not sure: gain/loss compares as is and is labeled "basis unknown"
- Send not a multiple of capacity: warn, suggest topping up with other soft cones or reject stock
- Return color different from plan: flag, do not block
- Return cones or kg different from sent: show the difference, do not block
- Their lot no is usually blank: match returns by worker and open send-out
- Partial returns allowed, the rest stays pending
- "In-house" is a built-in worker with its own capacity, no challan needed

**Weight changes (normal, not errors)**

- Oil added to yarn raises weight
- Moisture after dyeing raises weight
- Gain/loss report shows a normal range per worker, only odd batches are flagged
- One sample challan showed tubes at 6% of gross, so never mix gross and net

**Merge and split**

- Split: one batch into many (400 kg raw, 100 kg sent, 300 stays)
- Merge: many into one (80 + 20 soft cones to fill 100 for a dye batch)
- Merging different color, shade or denier: warn, allow with confirm
- Merging different supplier lots: warn (suppliers print "do not mix lots")
- Every split and merge links parent to child, share kept (70% lot a, 30% lot b)
- Tracing is per batch, not per cone

**Reject loop**

- Reject at final coning: count and reason (color, damage, other), weight comes later
- Reject stock is grouped by denier and remembers its old color
- Re-soft: rewind onto PVC, weigh in kg, new lot, same owner, marked "re-dye"
- Then sacks, job worker, dyed, final coning like any batch
- Dark colors are flagged, dark dye batches suggest reject stock of the same denier
- Rejected cones can be kept for a later order (black case)

**Orders**

- On create: check stock, show what is missing, reserve matching stock
- Reserved stock cannot be claimed by another order
- Status comes from linked batches, progress in kg
- Partial delivery allowed (95 of 100 kg)
- Change or cancel releases reserved stock
- New color needed while making an order or challan: add by name, fill later

**Alerts**

- Yarn pending longer than the worker's limit
- Order due in n days
- Delivered as an in-app badge and to the admin's Telegram bot
- A daily check runs them

**Monthly stock check**

- A difference becomes an adjustment with a reason
- An adjustment is its own entry, never overwrites history

**Scan**

- Order: on-device OCR with label matching, then Workers AI free tier, then manual
- Math check: gross − less = nett, and row sums against printed totals
- Mismatch: flag the row, never save silently
- Handwritten challans are typed by hand
- Multi-page challans: page 2 totals are running totals, do not double count

**Data limits**

- Free-tier numbers: `spec.md` Section 11
- Every query uses an index
- Reports are paginated
- Dashboards never repeat full scans
- PDF, Excel and sticker sheets are made on the device
- SMS is capped per month; email OTP uses Pingram, and Telegram copies each OTP to the configured owner
- The configured Telegram owner controls one global public-registration switch with `/registrations_on` and `/registrations_off`
- Public registration starts off; a fresh database blocks signup until the owner runs `/registrations_on`
- The saved switch lives in D1 and survives Worker deploys and restarts
- When public registration is disabled, unknown users are blocked before OTP; existing users keep all sign-in methods
- A valid invitation bypasses the public-registration pause; only Admins may issue invitations
- Invitation signup is a future feature and has no active invite flow yet

**Open**

- Suggested start kg on an order = order kg ÷ (1 + typical gain %), shown as a hint only
- Challan fields to check with your CA: date, number, both parties with gstin if registered, hsn and description, quantity, vehicle, copies in triplicate
- Sticker rules: when it prints
- Other challan types: numbering
- Prices and billing: calculation
