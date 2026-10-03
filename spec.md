# spec.md (v1, 3 oct 2026)

what this file is: screens, fields, data and tech, one small line per point, grouped by category.
business logic, calculations and edge cases live in rules.md.
to add a topic: copy the template at the bottom. to remove one: delete its block.
lines in "to confirm" are my ideas that you have not approved yet.

## overview

- internal business app for yarn job work: soft, dye, final coning, pack, deliver
- tracks stock only: where it is, what stage, who owns it
- no prices, billing, payments or accounting for now (schema stays open to add later)
- one app for android, windows, linux, mac and web
- english only
- no offline mode
- no data import from the old software, start fresh
- simple fields, short forms, smart defaults, remembers last picks
- 4 to 10 users on a normal day, 20 to 50 challans on a busy day

## platforms and tech

- one codebase: web app, desktop through electron (windows, linux, mac), phone as installed web app
- host on cloudflare free tier: static pages, workers api, d1 (sqlite) database
- free limits to respect: d1 5m row reads and 100k row writes per day, workers 100k requests per day, 10 ms cpu per request
- every query uses an index, reports are paginated, no full table scans
- pdf and excel are made on the device, not on the server

## auth

- android/phone: otp via email and sms, plus telegram
- electron app/web app: otp via email and sms, plus qr login, plus telegram
- telegram: bot on admin's account sends the login approval or code to admin, who can pass it to any user
- sms is limited, monthly cap set in settings
- admin invites users from settings, user then logs in with otp
- data: users(id, name, email, phone, role, status), devices(id, user_id, last_seen), otp(id, user_id, channel, code_hash, expires)

## roles and permissions

- admin: everything, invites users, edits saved entries, makes challans
- packer: sees only the packing screen, can only add
- admin can give "make challans" permission to other users
- only admin edits anything saved, every edit logs who, when and the old value
- more roles later with simple on/off permissions
- data: roles(id, name), permissions(user_id, key, on), audit_log(id, user_id, action, entity, old, new, at)

## companies

- admin adds own companies and switches from the top of the app
- per company: name, address, gstin, pan, mobile, terms text, challan series, stock, lot numbers
- shared across companies: parties, color book, tare items
- data: companies(id, name, address, gstin, pan, mobile, terms)

## parties (one list)

- one list for suppliers, customers and job workers, each with tags
- fields: name, tags, address, gstin, mobile
- many delivery locations per party, one default
- job worker extra: dye batch capacity (cones), pending alert days, kg basis (includes tubes: yes, no, not sure)
- built-in job worker "in-house" for own dyeing, with its own capacity
- data: parties(id, name, tags, address, gstin, mobile), locations(id, party_id, name, address, is_default), job_workers(party_id, capacity_cones, alert_days, kg_basis)

## stock model

- unit of stock is a batch
- batch: lot no, owner, holder, stage, denier/quality, color, cones, kg, parent links
- owner: one of my companies or a customer
- holder: my factory, a job worker, or in transit
- kg is the master unit, cones is a softer count
- operations: receive, send, return, process, split, merge, reject, adjust, change owner
- every operation links parent to child, so history is always traceable
- "history" button on any batch shows where it came from
- data: batches(id, lot_no, company_id, owner_id, holder_id, stage, denier, color_id, cones, kg), movements(id, type, from_batch, to_batch, kg, cones, by, at), links(parent_id, child_id, share)

## lot numbers

- one running number per company, auto, never typed, never reused, gaps fine
- every new batch takes the next number
- supplier lot is a separate field on raw material
- merge asks: keep main lot or make a new lot, default is the bigger one

## raw material in

- fields: date (today), supplier, owner, net kg
- optional: gross, supplier lot, denier, supplier challan no
- owner dropdown groups: my companies, customers
- owner type (own stock or customer yarn) fills itself from the pick
- totals only, no box rows
- optional photo scan fills the form (see scan challan)

## soft and sacks

- raw and soft are one stock, tracked in kg only
- soft yarn is packed in sacks and held in stock with sack count and kg
- softening is not a separate stage

## send to job worker

- fields: job worker, lot, denier, color, cones, gross, less (auto), nett, bags
- color default is "white grey (undyed)"
- totals only, one row
- cones split into dye batches by worker capacity (320 cones at 80 = 4 batches)
- warns if not a multiple, suggests topping up with other soft cones or reject stock
- color per batch: one color for all (default) or a different color per batch
- challan prints as one summary row or one row per dye batch
- making the send-out challan moves stock to the job worker

## receive from job worker

- pick job worker, app lists their open send-outs, pick one
- rows prefill per dye batch: color, cones, bags
- you type only kg per row from their challan (optional)
- "received in full" button skips everything else
- partial returns allowed (2 of 4 batches back)
- color different from plan is flagged
- optional: their challan no
- each dyed batch gets a new lot no and its color
- their lot no is usually blank, so match by worker and open send-out

## in-house dyeing

- same flow as a job worker, using the "in-house" worker
- pick recipe from the color book, dye amounts scale to kg
- no challan needed

## final coning

- pick dyed lot, final cones prefilled with the dyed count, one tap to accept
- change the count if it differs (split or merged cones are normal, no error)
- optional rejected count with reason (color, damage, other)
- rejected cones go to reject stock, grouped by denier, remembering old color

## reject loop

- rejects go back through: re-soft (rewind onto pvc), sacks, job worker, dyed, final coning
- weigh at re-soft (kg), new lot, keeps owner and old color, marked "re-dye"
- colors can be flagged dark (black, navy)
- a dark dye batch suggests reject stock of the same denier to fill it

## packing (packer screen)

- header: date (auto), lot, color, denier (filled from batch), tube type, box type (last used remembered)
- rows: box no (auto), gross, box tare, cones
- less and nett are auto
- entries wait as "packed, waiting for challan"
- box no: one global running number, unique, gaps allowed, deleted box leaves a void gap
- packer writes the box no on the cardboard, same number on sticker and challan
- a box with two lots uses the same box no on two lines
- data: boxes(id, box_no, company_id, batch_id, lot_no, gross, tare, cones, nett, packed_by, packed_at, challan_id, status)

## tare items (settings)

- list: type (tube, box, bag), name, weight per piece in grams
- helper: weigh N pieces, enter the total, average fills in
- dropdowns on forms, last pick remembered per stage and denier
- less = cones x tube wt + boxes x box wt + bags x bag wt
- changing a weight never changes old entries (each entry keeps its own copy)
- manual less override allowed
- tubes and cartons are not tracked as stock
- data: tare_items(id, type, name, grams, active)

## challans

- types: job worker send-out, delivery, return, custom
- each type has: heading text, series code (JW1, DC1), direction, item type (yarn or other), columns, stock effect, copies
- firm name stays the same on every type, the heading carries the type
- number: continuous per company per series, max 16 characters, optional yearly reset
- cancelled challan stays as "cancelled", number never reused, stock effect reversed
- issued challan is locked, only admin edits with a reason
- fields: date, number, my company, party, deliver at, vehicle no, driver, remarks, e-way bill no (optional), hsn (optional)
- delivery rows come from packed boxes, send-out uses totals
- gross - less = nett, all totals auto
- copies: original, duplicate, triplicate
- print on a5, share as pdf
- making a challan moves the stock by itself, no second entry
- local deliveries go with the delivery challan, out of state goes with the party report attached to the e-way bill
- data: challan_types(id, heading, series, direction, columns, stock_effect), challans(id, company_id, type_id, number, date, party_id, location_id, vehicle, driver, remarks, eway_no, status), challan_rows(id, challan_id, box_id, lot_no, denier, color_id, cones, gross, less, nett, bags)

## orders and kanban

- order: party, color, kg, denier/quality, due date, notes
- on create the app checks stock and says what is missing ("have 60 kg soft, need 40 more")
- matching stock is reserved so two orders cannot claim it
- status fills from linked batches, progress bar in kg
- partial delivery, change and cancel allowed
- kanban columns: raw/soft stock, sacks, at job worker, dyed, final coning, packed, delivered
- cards are batches tagged with their order, filter by order
- reject loop shows as an arrow from final coning back to soft
- moving a card (or "move to next" button on phone) opens a prefilled confirm
- columns can be renamed or hidden
- data: orders(id, party_id, color_id, kg, denier, due, notes, status), order_batches(order_id, batch_id, kg)

## color book (with recipes)

- one section, not two
- color = name + code (like maroon-8016), party, sample photo (optional), notes, dark flag
- built-in "white grey (undyed)"
- add a new color from an order or challan by typing the name only, fill the rest later
- same color name from different parties stays separate
- recipes live inside each color, a color can have several
- recipe: dye/chemical name and qty per kg, time, temperature, machine, optional steps
- recipe versions: old one kept and marked
- recipe can be tagged with yarn type (polyester, viscose)
- amounts scale to the batch kg
- a dyeing entry records which recipe was used
- data: colors(id, name, code, party_id, photo, notes, is_dark), recipes(id, color_id, version, yarn_type, time, temp, machine, steps), recipe_items(recipe_id, name, qty_per_kg)

## reports (every report has export excel and pdf)

- top priority: yarn pending at job workers (sent minus received, per worker and lot, days waiting)
- top priority: weight gain/loss per job worker and in-house (% over time, normal range, odd batches flagged)
- gain/loss only where their kg was entered, shows "basis unknown" if kg basis is not set
- party report: pick party and date range, pdf like the old sales challan report, optional cones column, sorted by date
- stock by stage and owner
- order status

## alerts

- yarn pending longer than that worker's limit (days)
- order due date near (n days before)
- sent to admin's telegram bot and shown as a badge in the app
- a daily check runs them

## monthly stock check

- app lists expected stock by lot
- tick "matches", type a count only where it differs
- a difference becomes an adjustment with a reason, history never overwritten
- last counted date shown per lot

## scan challan (optional)

- upload photo (2 for multi page)
- step 1: on-device ocr (paddleocr in the browser) plus label matching fills header and totals
- step 2: if totals not found, workers ai free tier
- step 3: if that is used up for the day, type totals by hand
- math check: gross - less = nett, row sums vs printed totals
- handwritten challans are not scanned, typed by hand
- raw material keeps totals only, rows only used for the check

## printing

- challan on a5, stickers on a4 sheets, pdf for everything
- sticker content and layout: see future topics

## dashboard (my suggestion, edit freely)

- today: boxes packed, challans made, kg delivered
- yarn at job workers with days waiting, red when over the limit
- orders due soon and overdue
- stock by stage (kg and cones), filter by owner
- reject stock count
- alerts list
- quick buttons: raw in, send, receive, pack, new challan
- packer sees only the packing screen and his entries today

## settings

- companies, users and invites, tare items, challan types and series
- alert limits, monthly sms cap, telegram bot link
- party list and color book have their own sections, not settings

## to confirm

- no machine tracking at any stage
- lot number assigned when soft yarn is sacked
- admin can log out any device
- daily backup file sent to admin's telegram
- keep the scanned photo with the entry
- suggested start kg for an order from typical gain/loss
- does a job work challan need an hsn code (ask your ca)
- per worker: is their kg net or gross
- meaning of the "remarks" text on the party report (ship-to?)

## future topics (blank, fill when ready)

## sticker labels

- what it shows:
- fields on the sticker:
- sheet size and stickers per sheet:
- who prints it:
- data:
- open:

## other challan types

- type name:
- heading text:
- series code:
- direction (out or in):
- item type:
- columns:
- stock effect:
- open:

## extra recipe fields

- field name:
- unit:
- required or optional:
- open:

## prices and billing (not now)

- what to track:
- where it shows:
- data:
- open:

## more roles

- role name:
- what it sees:
- what it can do:
- open:

## more alerts and channels

- alert:
- when it fires:
- channel:
- open:

## template (copy for a new topic)

## topic name

- what it shows:
- fields:
- rules:
- data:
- open:
