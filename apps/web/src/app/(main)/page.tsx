import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { YarnIndex } from "@/components/home/YarnIndex";
import { Process } from "@/components/home/Process";
import { ShadeStrip } from "@/components/home/ShadeStrip";
import { Markets } from "@/components/home/Markets";
import { Testimonials } from "@/components/home/Testimonials";
import { CtaBand } from "@/components/home/CtaBand";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <YarnIndex />
      <Process />
      <ShadeStrip />
      <Markets />
      <Testimonials />
      <CtaBand />
    </>
  );
}
