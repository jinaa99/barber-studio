import type { HeroClipRecord, MediaRecord } from "./types";

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
import heroEntry from "@/assets/media/hero-entry.jpg";
import heroCraft from "@/assets/media/hero-craft.jpg";
import heroDetail from "@/assets/media/hero-detail.jpg";
import heroResult from "@/assets/media/hero-result.jpg";

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

const mixkit = {
  provider: "Mixkit",
  license: "Mixkit Stock Video Free License",
  licenseUrl: "https://mixkit.co/license/#videoFree",
} as const;

/**
 * Home hero sequence. All four clips come from one Mixkit shoot (same room,
 * barber and client), downloaded at 720p from each clip's page. They were
 * trimmed, colour graded to the site palette, stripped of audio and
 * re-encoded; see docs/MEDIA.md. They are stock footage, not this studio.
 * Swap `sources` and `poster` to use the studio's own footage; an empty
 * `sources` array keeps the sequence working on posters alone.
 */
export const heroClipRecords = [
  {
    id: "arrival",
    sources: [{ src: "/media/hero/hero-entry.mp4", type: "video/mp4" }],
    playback: "scrub",
    poster: heroEntry,
    alt: {
      mn: "Тоосгон ханатай барбер студид эгнэн зогсох бор арьсан сандлуудын хажуугаар камер аажуухан урагшилж буй нь",
      en: "The camera drifts slowly past a row of brown leather barber chairs in a brick-walled studio",
    },
    focus: { landscape: "40% 50%", portrait: "30% 50%" },
    credit: {
      ...mixkit,
      title: "Male Barber Chairs",
      sourceUrl: "https://mixkit.co/free-stock-video/male-barber-chairs-43236/",
      edits: "First 8 s, cropped to remove the shop's wall sign, colour graded, audio removed.",
    },
  },
  {
    id: "craft",
    sources: [{ src: "/media/hero/hero-craft.mp4", type: "video/mp4" }],
    playback: "loop",
    poster: heroCraft,
    alt: {
      mn: "Хар бээлийтэй барбер сахалтай үйлчлүүлэгчийн хажуугийн үсийг машинаар засаж буй нь",
      en: "A barber in black gloves works the side of a bearded client's head with clippers",
    },
    focus: { landscape: "60% 40%", portrait: "52% 40%" },
    credit: {
      ...mixkit,
      title: "Barber cutting the hair of a bearded man",
      sourceUrl: "https://mixkit.co/free-stock-video/barber-cutting-the-hair-of-a-bearded-man-43222/",
      edits: "First 8 s, colour graded, audio removed.",
    },
  },
  {
    id: "detail",
    sources: [{ src: "/media/hero/hero-detail.mp4", type: "video/mp4" }],
    playback: "loop",
    poster: heroDetail,
    alt: {
      mn: "Ойрын зураг: барбер сам барьж, хайчаар чихний дээгүүр үсийг засаж буй нь",
      en: "Close-up of a barber cutting above the ear with scissors over a comb",
    },
    focus: { landscape: "35% 40%", portrait: "40% 40%" },
    credit: {
      ...mixkit,
      title: "Barber cutting hair with scissors and comb",
      sourceUrl: "https://mixkit.co/free-stock-video/barber-cutting-hair-with-scissors-and-comb-43232/",
      edits: "First 5 s, colour graded, audio removed.",
    },
  },
  {
    id: "result",
    sources: [{ src: "/media/hero/hero-result.mp4", type: "video/mp4" }],
    playback: "scrub",
    poster: heroResult,
    alt: {
      mn: "Засалт дууссаны дараа сахалтай үйлчлүүлэгч дээш харж суугаа нь",
      en: "The bearded client sits with his finished cut as the barber steps away",
    },
    focus: { landscape: "60% 35%", portrait: "46% 35%" },
    credit: {
      ...mixkit,
      title: "Barber combing his client's hair",
      sourceUrl: "https://mixkit.co/free-stock-video/barber-combing-his-clients-hair-43238/",
      edits: "Final 2.2 s (after the barber's branded apron leaves the frame), colour graded, audio removed.",
    },
  },
] satisfies HeroClipRecord[];
