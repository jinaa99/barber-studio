import type { BarberRecord } from "../types";

/** Fictional barbers for the demo. Portraits are licensed stock models, not these people. */
export const barberRecords: BarberRecord[] = [
  {
    id: "temuulen",
    name: { mn: "Тэмүүлэн", en: "Temuulen" },
    role: { mn: "Үүсгэн байгуулагч, мастер барбер", en: "Founder & master barber" },
    bio: {
      mn: "Арван хоёр жилийн турш хайчны засалт дээр төвлөрсөн. Сонгодог хэлбэрийг өнөөгийн хэв маягтай хослуулах дуртай.",
      en: "Twelve years focused on scissor work. Temuulen likes to bring classic shapes into the present without making them look dated.",
    },
    specialties: [
      { mn: "Хайчны засалт", en: "Scissor cuts" },
      { mn: "Сонгодог хажуу самнаа", en: "Classic side parts" },
      { mn: "Урт үс", en: "Longer hair" },
    ],
    yearsExperience: 12,
    imageId: "barber-temuulen",
    serviceIds: ["studio-cut", "scissor-cut", "clipper-cut", "beard-sculpt", "cut-and-beard", "full-ritual", "junior-cut", "custom-cut"],
    workingDays: ["tue", "wed", "thu", "fri", "sat"],
  },
  {
    id: "enkhjin",
    name: { mn: "Энхжин", en: "Enkhjin" },
    role: { mn: "Ахлах барбер", en: "Senior barber" },
    bio: {
      mn: "Фэйд болон богино засалтын нарийн шилжилтээрээ алдартай. Үс бүрийн ургалтын чиглэлийг нягт ажигладаг.",
      en: "Known for precise transitions on fades and short cuts, and for reading the direction of growth before every pass.",
    },
    specialties: [
      { mn: "Скин фэйд", en: "Skin fades" },
      { mn: "Текстур засалт", en: "Textured crops" },
      { mn: "Шугам тэгшлэлт", en: "Line-ups" },
    ],
    yearsExperience: 8,
    imageId: "barber-enkhjin",
    serviceIds: ["studio-cut", "skin-fade", "clipper-cut", "beard-sculpt", "cut-and-beard", "junior-cut", "custom-cut"],
    workingDays: ["tue", "wed", "fri", "sat", "sun"],
  },
  {
    id: "bilguun",
    name: { mn: "Билгүүн", en: "Bilguun" },
    role: { mn: "Барбер, сахал засалтын мастер", en: "Barber & beard specialist" },
    bio: {
      mn: "Шулуун хусуур, халуун алчуурын уламжлалт хусалтад дуртай. Сахлыг нүүрний хэлбэрт тааруулан хэлбэржүүлдэг.",
      en: "Devoted to the traditional straight-razor shave. Bilguun shapes beards to balance the face rather than follow a template.",
    },
    specialties: [
      { mn: "Халуун алчууртай хусалт", en: "Hot-towel shaves" },
      { mn: "Сахал хэлбэржүүлэлт", en: "Beard sculpting" },
      { mn: "Скин фэйд", en: "Skin fades" },
    ],
    yearsExperience: 6,
    imageId: "barber-bilguun",
    serviceIds: ["studio-cut", "skin-fade", "beard-sculpt", "hot-towel-shave", "cut-and-beard", "full-ritual", "custom-cut"],
    workingDays: ["wed", "thu", "fri", "sat", "sun"],
  },
];
