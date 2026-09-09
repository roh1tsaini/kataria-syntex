"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { cn } from "@kataria-syntex/shared";

const Accordion = AccordionPrimitive.Root;

/**
 * Pill ⇄ card morph (design.md §4.2): a closed item is a quiet row on the
 * page; opening grows it into a raised card. The surface (radius, border,
 * fill, shadow) rides `--ease-cinema` at `--dur-cinema` — the height
 * keyframes run the same curve, so the whole thing moves as one spring.
 */
function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "rounded-[var(--radius-chip)] border border-transparent transition-[background-color,border-color,border-radius,box-shadow] duration-[var(--dur-cinema)] ease-[var(--ease-cinema)] data-[state=open]:rounded-[var(--radius-card)] data-[state=open]:border-line data-[state=open]:bg-white data-[state=open]:shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 cursor-pointer items-center justify-between gap-4 px-4 py-5 text-left font-display text-base font-medium text-navy transition-colors hover:text-royal md:text-lg",
          className,
        )}
        {...props}
      >
        {children}
        <Plus
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-cinema)] ease-[var(--ease-cinema)] group-data-[state=open]:rotate-45"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm text-ink-soft data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("px-4 pb-5 leading-relaxed", className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
