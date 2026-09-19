import { Section } from "@/components/section/Section";

export default function ContactLoading() {
  return (
    <Section className="py-12 md:py-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="h-8 w-48 animate-pulse rounded bg-line" />
          <div className="h-20 w-full animate-pulse rounded bg-line/40" />
          <div className="h-40 w-full animate-pulse rounded-card bg-line/30" />
        </div>
        <div className="lg:col-span-7">
          <div className="h-96 w-full animate-pulse rounded-card bg-line/30" />
        </div>
      </div>
    </Section>
  );
}
