export interface Testimonial {
  name: string;
  company: string;
  country: string;
  quote: string;
}

export const testimonials: Testimonial[] = [
  {
    name: "Rajesh Mehta",
    company: "Mehta Textiles",
    country: "India",
    quote:
      "We've been sourcing cotton yarn from Kataria Syntex for over 5 years. The quality is always consistent, and delivery never misses the deadline.",
  },
  {
    name: "Ahmed Al-Rashid",
    company: "Gulf Fabrics LLC",
    country: "UAE",
    quote:
      "Their polyester yarn quality matches international standards, and the team understands export requirements perfectly.",
  },
  {
    name: "Priya Sharma",
    company: "Sharma Weaving Mills",
    country: "India",
    quote:
      "Whether we need fine cotton or heavy-duty polyester, Kataria Syntex has it. Fair pricing, and the quality speaks for itself.",
  },
  {
    name: "Michael Thompson",
    company: "TextileCraft Industries",
    country: "United Kingdom",
    quote:
      "Documentation, quality checks, timely shipping — importing from India was handled professionally end to end.",
  },
  {
    name: "Fatima Hassan",
    company: "Nile Cotton Trading",
    country: "Egypt",
    quote:
      "Premium-grade cotton yarn and very responsive to our specific requirements. Communication is always clear.",
  },
];
