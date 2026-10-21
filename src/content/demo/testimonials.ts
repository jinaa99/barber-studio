import type { TestimonialRecord } from "../types";

/**
 * Placeholder copy that shows the layout of the testimonials section. These
 * are NOT real reviews and are always rendered with a visible sample label.
 */
export const testimonialRecords: TestimonialRecord[] = [
  {
    id: "sample-1",
    quote: {
      mn: "Энд жишээ сэтгэгдэл байрлана: зочин засалт, үйлчилгээний талаар юу үнэлснээ богино, тодорхой бичнэ.",
      en: "A sample guest note sits here: a short, specific line about what they valued in the cut and the service.",
    },
    attribution: { mn: "Жишээ зочин · Студийн засалт", en: "Sample guest · Studio Cut" },
    isSample: true,
  },
  {
    id: "sample-2",
    quote: {
      mn: "Хоёр дахь жишээ сэтгэгдэл. Бодит сэтгэгдлийг зөвхөн зочны зөвшөөрөлтэйгөөр нийтэлнэ.",
      en: "A second sample note. Real reviews should only be published with the guest's permission.",
    },
    attribution: { mn: "Жишээ зочин · Сахал хэлбэржүүлэлт", en: "Sample guest · Beard Sculpt" },
    isSample: true,
  },
  {
    id: "sample-3",
    quote: {
      mn: "Гурав дахь жишээ сэтгэгдэл. Google эсвэл бусад платформын баталгаатай үнэлгээг энд холбож болно.",
      en: "A third sample note. Verified ratings from Google or another platform can be linked here.",
    },
    attribution: { mn: "Жишээ зочин · Бүрэн ёслол", en: "Sample guest · The Full Ritual" },
    isSample: true,
  },
];
