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
import { cn } from "@/lib/utils";
import { navLinks } from "@/content/nav";

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
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 ease-[var(--ease-out)]",
        scrolled
          ? "border-line bg-canvas/85 backdrop-blur-md"
          : "border-transparent bg-canvas/0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-[4px] bg-gradient-to-br from-royal to-sky"
          />
          <span className="font-body text-base font-extrabold tracking-tight text-navy">
            {site.name}
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "group relative py-1 font-body text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "text-royal"
                  : "text-ink-soft hover:text-navy",
              )}
            >
              {link.label}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 -bottom-0.5 h-px origin-left bg-current transition-transform duration-300",
                  isActive(link.href)
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100",
                )}
              />
            </Link>
          ))}
          <Button asChild variant="primary" size="sm">
            <Link href="/contact">Send inquiry</Link>
          </Button>
        </nav>

        {/* Mobile nav */}
        <div className="flex items-center md:hidden">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="cursor-pointer p-2.5 text-navy"
              >
                <Menu className="size-6" />
              </button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0">
              <DialogTitle className="sr-only">Menu</DialogTitle>
              <DialogDescription className="sr-only">
                Site navigation
              </DialogDescription>
              <div className="flex h-full flex-col justify-between px-6 pb-10 pt-20">
                <nav aria-label="Mobile" className="flex flex-col">
                  {navLinks.map((link, index) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "ks-enter flex items-baseline gap-4 border-b border-line-dark py-5 font-display text-3xl font-medium tracking-tight",
                        isActive(link.href) ? "text-sky" : "text-paper",
                      )}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <span className="tnum font-mono text-xs text-ice-soft">
                        0{index + 1}
                      </span>
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="flex flex-col gap-4">
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
