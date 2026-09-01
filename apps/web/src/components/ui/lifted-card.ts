/**
 * The shared "paper card that lifts on hover" treatment — compose it into a
 * card's className so every card surface lifts identically.
 */
export const liftedCard =
  "rounded-card border border-line bg-paper shadow-card transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float";
