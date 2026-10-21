import type { MediaRecord } from "./types";

import studioHero from "@/assets/media/studio-hero.jpg";
import studioInterior from "@/assets/media/studio-interior.jpg";
import studioChair from "@/assets/media/studio-chair.jpg";
import studioFloor from "@/assets/media/studio-floor.jpg";
import studioTools from "@/assets/media/studio-tools.jpg";
import workStraightRazor from "@/assets/media/work-straight-razor.jpg";
import workBeardSculpt from "@/assets/media/work-beard-sculpt.jpg";
import workSidePart from "@/assets/media/work-side-part.jpg";
import workTextureShears from "@/assets/media/work-texture-shears.jpg";
import workScissorOverComb from "@/assets/media/work-scissor-over-comb.jpg";
import workDetailComb from "@/assets/media/work-detail-comb.jpg";
import workLineUp from "@/assets/media/work-line-up.jpg";

/**
 * Demo photography. Every image was downloaded from its Unsplash page and is
 * used under the Unsplash License (https://unsplash.com/license). Replace
 * these with the studio's own photography before launch.
 */
export const mediaRecords = [
  {
    id: "studio-hero",
    src: studioHero,
    alt: {
      mn: "Бүдэг гэрэлтэй студид барбер ташуу суусан үйлчлүүлэгчийн сахлыг хайчаар засаж буй нь",
      en: "In a dim studio, a barber trims a reclining client's beard with scissors",
    },
    credit: {
      author: "Allef Vinicius",
      sourceUrl: "https://unsplash.com/photos/man-sitting-on-barbers-chair-IvQeAVeJULw",
      license: "Unsplash License",
    },
  },
  {
    id: "studio-interior",
    src: studioInterior,
    alt: {
      mn: "Тоосгон хана, дүүжин гэрлийн доор эгнэсэн хар арьсан барбер сандлууд",
      en: "Black leather barber chairs lined up beneath pendant lights against a brick wall",
    },
    credit: {
      author: "Nathon Oski",
      sourceUrl:
        "https://unsplash.com/photos/black-leather-barber-chair-near-brown-brick-wall-EW_rqoSdDes",
      license: "Unsplash License",
    },
  },
  {
    id: "studio-chair",
    src: studioChair,
    alt: {
      mn: "Цагаан өрөөнд, хар цагаан дөрвөлжин шалан дээрх хар арьсан барбер сандал",
      en: "A black leather barber chair on a black-and-white checkered floor in a white room",
    },
    credit: {
      author: "Caio Coelho",
      sourceUrl:
        "https://unsplash.com/photos/black-leather-barber-chair-in-white-room-OOKPHqAICKA",
      license: "Unsplash License",
    },
  },
  {
    id: "studio-floor",
    src: studioFloor,
    alt: {
      mn: "Барберууд студийн танхимд хоёр үйлчлүүлэгчийн үсийг засаж буй нь",
      en: "Barbers at work on two clients across the studio floor",
    },
    credit: {
      author: "Mitchell Orr",
      sourceUrl:
        "https://unsplash.com/photos/a-man-getting-his-hair-cut-at-a-barber-shop-pL6-dYFSGWI",
      license: "Unsplash License",
    },
  },
  {
    id: "studio-tools",
    src: studioTools,
    alt: {
      mn: "Модон ширээн дээрх шифер хавтан дээр байрлуулсан үсний машин, хайч, сам, арчилгааны бүтээгдэхүүн",
      en: "Clippers, scissors, a comb and grooming products laid out on a slate board",
    },
    credit: {
      author: "Andrea Donato",
      sourceUrl: "https://unsplash.com/photos/hair-clippers-and-grooming-tools-MNu0n-3BIKs",
      license: "Unsplash License",
    },
  },
  {
    id: "work-straight-razor",
    src: workStraightRazor,
    alt: {
      mn: "Шивээстэй барбер шулуун хусуураар үйлчлүүлэгчийн чихний орчмын үсийг тэгшилж буй нь",
      en: "A tattooed barber shaping the hairline around a client's ear with a straight razor",
    },
    credit: {
      author: "Agustin Fernandez",
      sourceUrl:
        "https://unsplash.com/photos/barber-trimming-hair-with-straight-razor-1Pmp9uxK8X8",
      license: "Unsplash License",
    },
  },
  {
    id: "work-beard-sculpt",
    src: workBeardSculpt,
    alt: {
      mn: "Хар цагаан зураг: барбер хайчаар үйлчлүүлэгчийн өтгөн сахлыг хэлбэржүүлж буй нь",
      en: "Black-and-white photo of a barber shaping a client's full beard with scissors",
    },
    credit: {
      author: "Nathon Oski",
      sourceUrl:
        "https://unsplash.com/photos/grayscale-photography-of-person-holding-scissor-clipping-mans-beard-fE42nRlBcG8",
      license: "Unsplash License",
    },
  },
  {
    id: "work-side-part",
    src: workSidePart,
    alt: {
      mn: "Дээрээс харсан нь: барбер хажуу тийш самнасан сонгодог засалтыг хэвэнд оруулж буй нь",
      en: "Overhead view of a barber finishing a classic side-parted cut",
    },
    credit: {
      author: "Hair Spies",
      sourceUrl:
        "https://unsplash.com/photos/a-man-getting-his-hair-cut-at-a-barber-shop-FtYpeIRDzaw",
      license: "Unsplash License",
    },
  },
  {
    id: "work-texture-shears",
    src: workTextureShears,
    alt: {
      mn: "Барбер сам болон шингэлэх хайчаар оройн үсийг засаж буй ойрын зураг",
      en: "Close-up of a barber texturing the top with thinning shears and a comb",
    },
    credit: {
      author: "Gulom Nazarov",
      sourceUrl:
        "https://unsplash.com/photos/barber-trimming-hair-with-thinning-shears-DrG4V5skbMY",
      license: "Unsplash License",
    },
  },
  {
    id: "work-scissor-over-comb",
    src: workScissorOverComb,
    alt: {
      mn: "Барбер хайч, самаар сахалтай үйлчлүүлэгчийн хажуугийн үсийг засаж буй нь",
      en: "A barber working scissor-over-comb on the side of a bearded client's head",
    },
    credit: {
      author: "Nate Johnston",
      sourceUrl:
        "https://unsplash.com/photos/a-man-cutting-another-mans-hair-with-a-pair-of-scissors-tgPrIYnW3g4",
      license: "Unsplash License",
    },
  },
  {
    id: "work-detail-comb",
    src: workDetailComb,
    alt: {
      mn: "Хар бээлийтэй барбер сам, хайчаар богино засалтын шилэн хэсгийг засаж буй нь",
      en: "A barber in black gloves refining a short cut at the crown with comb and scissors",
    },
    credit: {
      author: "Peter Vimalis",
      sourceUrl:
        "https://unsplash.com/photos/a-barber-in-black-gloves-cutting-a-mans-hair-CMt1rgM5Y0I",
      license: "Unsplash License",
    },
  },
  {
    id: "work-line-up",
    src: workLineUp,
    alt: {
      mn: "Хар бээлийтэй барбер тримерээр үйлчлүүлэгчийн духны үсний шугамыг тэгшилж буй нь",
      en: "A barber in black gloves edging a client's hairline with a trimmer",
    },
    credit: {
      author: "John Rodriguez",
      sourceUrl: "https://unsplash.com/photos/barber-using-trimmer-on-man-g4lupAofR9c",
      license: "Unsplash License",
    },
  },
] satisfies MediaRecord[];

export type MediaId = (typeof mediaRecords)[number]["id"];

/**
 * Optional muted hero loop (e.g. `{ src: "/media/hero.mp4", type: "video/mp4" }`
 * placed in /public/media). `null` uses the still image. No licensed footage
 * has been sourced yet; Phase 02 replaces this with the scroll-driven sequence.
 */
export const heroVideo: { src: string; type: string } | null = null;
