/**
 * The shared "paper card that lifts on hover" treatment — compose it into a
 * card's className so every card surface lifts identically. The sheen
 * utility adds the sky catch-light along the top edge.
 */
export const liftedCard =
  "card-sheen relative rounded-card border border-line bg-paper shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float";
