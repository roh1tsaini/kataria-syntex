/** Class merge for NativeWind — mirrors apps/app's cn(). */
import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
