import { localizedPath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { ButtonLink } from "@/components/ui/button";
import { PageIntro } from "@/components/sections/page-intro";

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.notFound;
  return (
    <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} className="min-h-[70svh]">
      <ButtonLink href={localizedPath(locale)} className="mt-10" arrow>
        {t.cta}
      </ButtonLink>
    </PageIntro>
  );
}
