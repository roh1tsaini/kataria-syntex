import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * Layout for the main website pages (everything except standalone
 * surfaces like the /links card). Owns the site chrome: header and
 * footer. Scrolling is native — CSS `scroll-behavior: smooth` covers
 * anchor navigation.
 */
export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
