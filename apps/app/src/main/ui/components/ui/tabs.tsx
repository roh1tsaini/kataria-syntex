import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/ui/lib/cn";
import { EASE_OUT } from "@/ui/lib/motion";

const Tabs = TabsPrimitive.Root;

/* Shared layoutId scope so the underline slides within one tab group only. */
const TabsIndicatorContext = React.createContext<string>("tab-underline");

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const indicatorId = React.useId();
  return (
    <TabsIndicatorContext.Provider value={`tab-underline-${indicatorId}`}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex h-11 items-center gap-1 border-b border-border text-muted-foreground sm:h-10",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsIndicatorContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const indicatorId = React.useContext(TabsIndicatorContext);
  const reduce = useReducedMotion();
  const indicatorClass =
    "absolute inset-x-2.5 bottom-0 hidden h-0.5 rounded-full bg-foreground group-data-[state=active]:block";
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "group relative inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {reduce ? (
        <span aria-hidden className={indicatorClass} />
      ) : (
        <motion.span
          aria-hidden
          layoutId={indicatorId}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className={indicatorClass}
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
