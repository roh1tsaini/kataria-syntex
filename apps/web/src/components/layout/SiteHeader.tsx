"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { site } from "@/content/site";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@kataria-syntex/shared";
import { navLinks } from "@/content/nav";

/**
 * Frosted-glass header — the canvas shows through a blur at every scroll
 * position; the scrolled state deepens the surface and adds a hairline +
 * contact shadow so content passes underneath with clear separation.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 12);
          ticking = false;
        });
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-out)]",
        scrolled
          ? "border-line bg-canvas/85 shadow-xs backdrop-blur-xl"
          : "border-transparent bg-canvas/50 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-royal to-sky shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_4px_10px_-2px_rgb(30_58_138/0.5)] transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-105"
          >
            <span className="font-display text-[15px] leading-none font-bold text-white">
              K
            </span>
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-navy">
            {site.name}
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                isActive(link.href)
                  ? "bg-navy/[0.07] text-royal"
                  : "text-ink-soft hover:bg-navy/[0.04] hover:text-navy",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-2">
            <Button asChild variant="primary" size="sm">
              <Link href="/contact">Send inquiry</Link>
            </Button>
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="flex items-center md:hidden">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="cursor-pointer rounded-full p-2.5 text-navy transition-colors hover:bg-navy/[0.05]"
              >
                <Menu className="size-6" />
              </button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0">
              <DialogTitle className="sr-only">Menu</DialogTitle>
              <DialogDescription className="sr-only">
                Site navigation
              </DialogDescription>
              <div className="relative flex h-full flex-col justify-between px-6 pb-10 pt-20">
                <nav aria-label="Mobile" className="flex flex-col">
                  {navLinks.map((link, index) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "ks-enter flex items-baseline gap-4 border-b border-line-dark py-5 font-display text-3xl font-medium tracking-tight transition-colors",
                        isActive(link.href) ? "text-sky" : "text-paper",
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="tnum font-mono text-xs text-ice-soft">
                        0{index + 1}
                      </span>
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div
                  className="ks-enter flex flex-col gap-4"
                  style={{ animationDelay: "220ms" }}
                >
                  <Button asChild variant="on-dark" size="lg">
                    <Link href="/contact" onClick={() => setMenuOpen(false)}>
                      Send inquiry
                    </Link>
                  </Button>
                  <p className="font-mono text-[11px] tracking-wide text-ice-soft">
                    {site.contact.phone} · {site.contact.email}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
