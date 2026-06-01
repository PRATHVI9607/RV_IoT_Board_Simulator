import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a 32-bit value as 0x-prefixed, zero-padded, uppercase hex. */
export function hex32(v: number): string {
  return "0x" + (v >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/** Format an n-nibble hex value (no prefix). */
export function hexN(v: number, nibbles: number): string {
  return (v >>> 0).toString(16).toUpperCase().padStart(nibbles, "0");
}
