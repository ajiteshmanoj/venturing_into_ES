Build an interactive web demo for a food-waste-reduction ordering system called 
"RightPortion" (suggest a better name if you have one). It has TWO connected views: 
a DINER ordering flow and an OPERATOR dashboard. This is for a university 
entrepreneurship Demo Day, so it must look polished, be fully clickable, and run on 
realistic seed data. No real backend — use in-memory seed data and React state.

============================================================
REAL-WORLD DATA THE SEED DATA MUST BE CALIBRATED TO
============================================================
This demo runs on SIMULATED data, but the numbers must be MODELLED ON published 
research so they're defensible, not invented. Calibrate the seed data to these real 
reference points, and surface this honestly in the UI (see "HONESTY FRAMING" below):

- Food service = ~28% of food waste (Singapore NEA + global UNEP both land on 28%).
- Roughly ~50% of buffet/prepared food can be wasted in high-waste settings 
  (Straits Times, 2025).
- Portion interventions reduce plate waste substantially: one campus study cut plate 
  waste ~66%; reduced-size entrées dropped waste from 77g to 45g per plate; other 
  studies show 12–34% reduction — WITH no loss of diner satisfaction.
- CRITICAL design principle from the research: information ALONE does not reduce 
  waste; letting people ACT (choose a smaller portion) is what works. So the demo 
  must let diners act in one tap, not just warn them.

Realistic portion-weight anchors (common-sense estimates, not a measured dataset — 
label them as such): fried rice ~300–400g; shared meat/veg zi char dish ~200–350g; 
steamed fish ~400–600g; soup ~500ml+.

Waste-rate rule to bake into seed data: a table ordering ~1 dish per person wastes 
little; waste rate climbs as dishes-per-person exceeds ~1; high-waste cases should 
land in a range consistent with the ~50% buffet figure. Add realistic noise.

============================================================
TECH & SETUP
============================================================
- Single-page React app (Vite + React) with Tailwind.
- FIRST read any available frontend-design skill/guidance and follow it for 
  typography, color tokens, spacing, and components. Aim for a calm, premium, modern 
  SaaS aesthetic — NOT default-Bootstrap, NOT clichéd bright-eco-green. Prefer 
  teal/sage accents with warm neutrals.
- All client-side. NO localStorage/sessionStorage — keep state in React state only.
- Responsive and projector-friendly: generous font sizes, high contrast.
- Top-level toggle to switch between "Diner View" and "Operator View" in one session.

============================================================
CONTEXT: shared / family-style restaurant (e.g. zi char)
============================================================
A table orders dishes to share. The core idea: help the table order the right number 
of dishes for their party size, using the restaurant's own historical waste data, so 
less food is wasted.

============================================================
SEED DATA (create a dedicated seed-data file)
============================================================
1. A menu of ~12 shared dishes: name, category (rice/noodle, meat, vegetable, 
   seafood, soup, tofu), price in SGD, typical portion weight in grams (use the 
   anchors above), and "typical servings" (how many people one dish feeds).
   Suggested dishes: Fried Rice, Hor Fun, Sweet & Sour Pork, Kung Pao Chicken, 
   Stir-fried Kailan, Salted Egg Prawns, Steamed Fish, Mapo Tofu, Tom Yum Soup, 
   Cereal Chicken, Sambal Vegetables, Claypot Tofu.
2. ~200 seeded past table visits: party_size (1–8), dishes_ordered, 
   total_food_weight_g, wasted_weight_g, date. Design a CLEAR pattern per the 
   waste-rate rule above, with realistic noise.
3. Derived stats the engine uses: average waste rate by (party_size, 
   dishes_per_person) bucket.
Add a top-of-file comment stating the data is simulated and calibrated to the 
research figures listed above.

============================================================
DINER VIEW — screens
============================================================
Step 1 — Party size entry: clean "How many are dining today?" with a tappable 1–8+ 
selector.

Step 2 — Menu & ordering: attractive dish cards (name, price, "feeds ~X" hint); 
add/remove dishes; live order summary (dishes + total price).

Step 3 — Live Order Checker (real-time as dishes are added): gentle inline nudges, 
e.g. "Adding another Fried Rice may be excessive for 3 people — most tables your 
size finish 3 dishes." Soft nudge, never a hard block.

Step 4 — Waste Prediction (before confirming): 
- "Based on your current order, approximately {X}g of food may be left uneaten." 
  Compute X from seed-data waste rates for this party_size + dishes_per_person.
- Traffic-light indicator: Low (green) / Medium (yellow) / High (red).
- ALWAYS-VISIBLE "Why this estimate?" expandable showing inputs in plain language: 
  party size, dishes ordered, dishes-per-person ratio, "based on N past visits by 
  tables your size." Transparency is the point — no black box.

Step 5 — Portion Size Suggestions: for applicable dishes offer Regular / Half / 
Sharing. Choosing smaller updates BOTH predicted waste (grams down) AND price (down) 
live — the "act on it, don't just warn" principle made tangible.

Step 6 — Confirmation: clean summary (final order, final predicted waste ideally now 
green, price) + "Nice — this order is right-sized for your table." On confirm, write 
the visit into in-memory history so the Operator View updates live (closing the loop).

============================================================
OPERATOR VIEW — dashboard (the business case)
============================================================
- Header stats (big numbers): total food waste this month (kg), waste reduced vs 
  baseline (%), estimated cost saved (SGD), estimated meals'-worth saved.
- Waste-trend chart (recharts) showing waste trending DOWN over recent weeks.
- "Waste by party size" breakdown showing which table sizes over-order most.
- Learning-loop visual: Data in (party size + measured waste) → model updates → 
  better recommendations → less waste → repeat. Make this loop visually central.
- Live table-visit feed pulling from the same in-memory history the diner flow writes 
  to, so a completed diner order appears here live — proving the closed loop on stage.
- Honest "How waste is measured" card: in a real deployment, aggregate waste is 
  weighed per SERVICE at the clearing station (or via smart-bin sensors), NOT per 
  individual plate. State this plainly.

============================================================
RECOMMENDATION ENGINE (keep it transparent)
============================================================
Implement prediction/recommendation as clear, rule-based logic over the seed data — 
NOT a fake AI. Core rule: compare the table's dishes-per-person ratio against 
historical waste rates for similar tables; recommend the dish count / portions that 
historically minimized waste while still feeding the party. Expose this logic in the 
"Why this estimate?" panel. Add inline comments where this logic lives so I can 
explain it if a judge asks.

============================================================
HONESTY FRAMING (important for credibility)
============================================================
- Somewhere visible (e.g. a small footer badge or an info tooltip on both views), 
  state: "Demo runs on simulated data modelled on published food-waste research." 
- The "How waste is measured" card must be honest about per-service (not per-plate) 
  measurement.
- Do not present any number as a measured real-world result; frame all figures as 
  modelled/illustrative.

============================================================
POLISH / DEMO AIDS
============================================================
- Cohesive sustainability-adjacent palette (teal/sage + warm neutrals). Follow the 
  frontend-design skill. Smooth micro-interactions: dishes animate into the order, 
  the waste meter animates, the traffic light transitions.
- Nice empty/edge states; a small onboarding hint on each view.
- A subtle "Demo Day Reset" button to re-run the flow cleanly in front of judges.
- KEY DEMO MOMENT: a "Load over-order scenario" button on the diner view that 
  pre-fills an OVER-ordering example so I can instantly show a RED high-waste 
  prediction, then fix it live with portion choices to flip it GREEN. Make this 
  smooth and satisfying — it's my signature demo moment.

============================================================
DELIVERABLE
============================================================
- A runnable app + the run command.
- Modular, readable components.
- Seed data and recommendation logic clearly separated and commented.