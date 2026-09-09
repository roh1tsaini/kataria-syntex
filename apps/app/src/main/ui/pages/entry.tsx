/**
 * Entry screen — what a logged-out visitor sees at "/" in a plain browser.
 * Two paths, nothing else: sign in here (web/PWA) or install it on this
 * device. Platform detection only names the install button; the download
 * page keeps every platform reachable. No taglines, no helper copy.
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
import { EntryWash } from "@/ui/components/entry-wash";
import { EASE_OUT } from "@/ui/lib/motion";

export function EntryPage() {
  const reduceMotion = useReducedMotion();
  const showInstall = isPlainBrowser();
  const platform = detectPlatformLabel();
  const rise = reduceMotion ? 0 : 6;

  return (
    <div className="entry-stage flex min-h-dvh flex-col items-center justify-center gap-7 bg-background p-4 sm:p-6">
      <EntryWash />
      <motion.div
        initial={{ opacity: 0, y: rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.15 : 0.2, ease: EASE_OUT }}
        className="flex items-center gap-3"
      >
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0.15 : 0.24,
          delay: reduceMotion ? 0 : 0.04,
          ease: EASE_OUT,
        }}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/auth">
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        {showInstall && (
          <>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to="/download">
                <Download className="size-4" aria-hidden />
                Install for {platform}
              </Link>
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
