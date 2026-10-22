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
    <main id={`main-${locale}`} className="flex min-h-dvh flex-col bg-canvas">
      <Container className="flex flex-1 flex-col items-center justify-center py-16">
        <div className="w-full max-w-sm">
          <Link href={localizedPath(locale)} aria-label={studio.name} className="mb-10 inline-block">
            <Wordmark wordmark={studio.wordmark} />
          </Link>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-40px_rgb(18_18_17/0.35)] sm:p-8">
            <p className="text-sm text-muted">{dict.admin.eyebrow}</p>
            <h1 className="mt-2 text-[1.75rem] font-medium leading-tight tracking-[-0.03em]">{t.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.lead}</p>
            <div className="mt-8">
              <LoginForm locale={locale} dict={t} />
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
