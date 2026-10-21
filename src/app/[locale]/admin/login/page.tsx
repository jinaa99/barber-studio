import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath } from "@/i18n/config";
import { getStudioProfile } from "@/lib/data";
import { Container } from "@/components/ui/container";
import { Wordmark } from "@/components/layout/wordmark";
import { LoginForm } from "@/components/admin/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.adminLogin, robots: { index: false, follow: false } };
}

export default async function AdminLoginPage() {
  const locale = await getLocale();
  const [dict, studio] = await Promise.all([getDictionary(locale), getStudioProfile()]);
  const t = dict.admin.login;

  return (
    <Container as="main" id={`main-${locale}`} className="py-section">
      <div className="mx-auto max-w-sm">
        <Link href={localizedPath(locale)} aria-label={studio.name} className="mb-12 inline-block">
          <Wordmark wordmark={studio.wordmark} />
        </Link>
        <p className="eyebrow text-taupe-deep">{dict.admin.eyebrow}</p>
        <h1 className="mt-4 text-display-md font-medium">{t.title}</h1>
        <p className="mt-3 text-sm text-taupe-deep">{t.lead}</p>
        <div className="mt-10">
          <LoginForm locale={locale} dict={t} />
        </div>
      </div>
    </Container>
  );
}
