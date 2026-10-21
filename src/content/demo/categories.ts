import type { LocalizedText } from "@/i18n/config";

/** Starting service categories (the seed creates any that are missing). Staff edit them in the dashboard. */
export const categoryRecords: { id: string; name: LocalizedText }[] = [
  { id: "haircut", name: { mn: "Үс засалт", en: "Haircuts" } },
  { id: "beard", name: { mn: "Сахал ба хусалт", en: "Beard & shave" } },
  { id: "ritual", name: { mn: "Багц үйлчилгээ", en: "Combined services" } },
];
