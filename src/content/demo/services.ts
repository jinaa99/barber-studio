import type { ServiceRecord } from "../types";

const consultation = { mn: "Зөвлөгөө", en: "Consultation" };
const wash = { mn: "Угаалга", en: "Wash" };
const finish = { mn: "Хэвэнд оруулалт", en: "Style & finish" };

export const serviceRecords: ServiceRecord[] = [
  {
    id: "studio-cut",
    category: "haircut",
    name: { mn: "Студийн засалт", en: "Studio Cut" },
    summary: {
      mn: "Таны үсний ургалт, нүүрний хэлбэрт тохируулсан хайч, машины хосолсон засалт.",
      en: "A scissor-and-clipper cut tailored to your growth pattern and face shape.",
    },
    includes: [consultation, wash, finish],
    durationMinutes: 60,
    price: 65000,
    featured: true,
  },
  {
    id: "skin-fade",
    category: "haircut",
    name: { mn: "Скин фэйд", en: "Skin Fade" },
    summary: {
      mn: "Арьснаас эхэлсэн жигд шилжилттэй, цэвэр шугамтай фэйд.",
      en: "A seamless fade from the skin up, finished with sharp, clean lines.",
    },
    includes: [consultation, wash, { mn: "Шугам тэгшлэлт", en: "Line-up" }, finish],
    durationMinutes: 60,
    price: 70000,
    featured: true,
  },
  {
    id: "scissor-cut",
    category: "haircut",
    name: { mn: "Хайчны засалт", en: "Scissor Cut" },
    summary: {
      mn: "Урт болон дунд урттай үсэнд зориулсан бүрэн хайчны засалт.",
      en: "A full scissor cut for longer and mid-length hair, with texture worked in by hand.",
    },
    includes: [consultation, wash, finish],
    durationMinutes: 75,
    price: 75000,
    featured: false,
  },
  {
    id: "clipper-cut",
    category: "haircut",
    name: { mn: "Машинан засалт", en: "Clipper Cut" },
    summary: {
      mn: "Нэг эсвэл хоёр түвшний энгийн, цэвэрхэн машинан засалт.",
      en: "A simple, tidy clipper cut at one or two lengths.",
    },
    includes: [consultation, finish],
    durationMinutes: 30,
    price: 40000,
    featured: false,
  },
  {
    id: "beard-sculpt",
    category: "beard",
    name: { mn: "Сахал хэлбэржүүлэлт", en: "Beard Sculpt" },
    summary: {
      mn: "Сахлын хэлбэр, урт, шугамыг тодорхойлж, халуун алчуур, тосоор дуусгана.",
      en: "Shape, length and lines defined, finished with a hot towel and beard oil.",
    },
    includes: [consultation, { mn: "Халуун алчуур", en: "Hot towel" }, { mn: "Сахлын тос", en: "Beard oil" }],
    durationMinutes: 30,
    price: 40000,
    featured: true,
  },
  {
    id: "hot-towel-shave",
    category: "beard",
    name: { mn: "Халуун алчууртай хусалт", en: "Hot-Towel Shave" },
    summary: {
      mn: "Шулуун хусуураар хийх уламжлалт хусалт. Халуун, хүйтэн алчуураар арьсыг бэлдэж, тайвшруулна.",
      en: "A traditional straight-razor shave with hot and cold towels to prepare and calm the skin.",
    },
    includes: [{ mn: "Халуун алчуур", en: "Hot towel" }, { mn: "Шулуун хусуур", en: "Straight razor" }, { mn: "Арьс арчилгаа", en: "Skin care" }],
    durationMinutes: 45,
    price: 55000,
    featured: true,
  },
  {
    id: "cut-and-beard",
    category: "ritual",
    name: { mn: "Засалт ба сахал", en: "Cut & Beard" },
    summary: {
      mn: "Студийн засалт болон сахал хэлбэржүүлэлтийг нэг дор.",
      en: "Our Studio Cut and Beard Sculpt in a single appointment.",
    },
    includes: [consultation, wash, { mn: "Сахал хэлбэржүүлэлт", en: "Beard sculpt" }, finish],
    durationMinutes: 90,
    price: 95000,
    featured: false,
  },
  {
    id: "full-ritual",
    category: "ritual",
    name: { mn: "Бүрэн ёслол", en: "The Full Ritual" },
    summary: {
      mn: "Засалт, халуун алчууртай хусалт эсвэл сахал засалт, толгойн массаж — бүтэн хоёр цаг.",
      en: "Cut, hot-towel shave or beard work, and a scalp massage — two unhurried hours.",
    },
    includes: [consultation, wash, { mn: "Хусалт эсвэл сахал", en: "Shave or beard" }, { mn: "Толгойн массаж", en: "Scalp massage" }, finish],
    durationMinutes: 120,
    price: 140000,
    featured: true,
  },
  {
    id: "junior-cut",
    category: "haircut",
    name: { mn: "Хүүхдийн засалт", en: "Junior Cut" },
    summary: {
      mn: "12 хүртэлх насны хүүхдэд зориулсан тайван, хурдан засалт.",
      en: "A calm, quick cut for children under twelve.",
    },
    includes: [finish],
    durationMinutes: 30,
    price: 35000,
    featured: false,
  },
];
