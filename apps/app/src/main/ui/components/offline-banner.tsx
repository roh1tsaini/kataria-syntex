/**
 * Offline banner.
 *
 * Saving is online-only: when the server is unreachable this strip says so
 * plainly. Nothing to tap and nothing queued — the form the user was filling
 * stays open with its input intact, and saving works again as soon as the
 * connection returns.
 */
import { AnimatePresence, motion } from "motion/react";

import { CloudOff } from "lucide-react";
import { useSync } from "@kataria-syntex/app-core";

import { EASE_OUT } from "@/ui/lib/motion";

export function OfflineBanner() {
  const online = useSync((s) => s.online);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 py-2 pr-4 pl-16 text-sm font-medium text-warning md:px-4 md:pl-4"
          role="status"
        >
          <CloudOff className="size-4" aria-hidden />
          <span>You&rsquo;re offline — go online to save.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
