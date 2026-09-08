/**
 * Entry screen — what a logged-out visitor sees at "/" in a plain browser.
 * Two paths: use the app right here (web/PWA) or install it on this device.
 * Platform detection only recommends; every option stays reachable.
 *
 * Installed contexts (Electron, standalone PWA) never render this
 * — App.tsx sends them straight to /auth.
 */
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Download } from "lucide-react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { detectPlatformLabel, isPlainBrowser } from "@/lib/platform";
import { Button } from "@/ui/components/ui/button";
import { EASE_OUT } from "@/ui/lib/motion";

export function EntryPage() {
  const reduceMotion = useReducedMotion();
  const showInstall = isPlainBrowser();
  const platform = detectPlatformLabel();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <span
            className="text-lg font-semibold leading-none tracking-tight"
            aria-hidden
          >
            K
          </span>
        </div>
        <div className="text-[17px] font-semibold tracking-tight">
          {COMPANY_DETAILS.name} Biz App
        </div>
      </div>

      <motion.div
        initial={{
          opacity: 0,
          y: reduceMotion ? 0 : 6,
          scale: reduceMotion ? 1 : 0.99,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.15 : 0.24, ease: EASE_OUT }}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <Button asChild size="lg" className="min-h-12">
          <Link to="/auth">
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        {showInstall && (
          <>
            <Button asChild size="lg" variant="outline" className="min-h-12">
              <Link to="/download">
                <Download className="size-4" aria-hidden />
                Install for {platform}
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Chrome, Edge or Safari: use it right here. Install the app for
              daily use on this device.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
