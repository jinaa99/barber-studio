import { Suspense } from "react";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/admin/format";
import { isConnectResult, isSocialProvider, type SocialProviderKey } from "@/lib/social/meta";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import {
  listSocialAccounts,
  loadInsights,
  metaApi,
  pendingPageChoice,
  socialConfig,
  type InsightsResult,
  type SocialAccountView,
} from "@/lib/server/social";
import { checkConnectionAction, choosePageAction, startConnectionAction } from "@/app/[locale]/admin/actions/social";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { DisconnectSocialButton } from "@/components/admin/social-disconnect";
import { EmptyState, Forbidden, Notice, PageHeader, PageSkeleton, Section, StatGroup, StatTile, Tag, textLink } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.social} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/social">;

export default async function SocialPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Social locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const count = (value: number, locale: Locale) => new Intl.NumberFormat(locale === "mn" ? "mn-MN" : "en-US").format(value);

async function Social({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("social.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin.social;
  const query = await searchParams;
  const result = one(query.result);
  const resultProvider = one(query.provider);
  const chooseId = one(query.choose);

  const config = socialConfig();
  const api = metaApi(config);
  const stored = await listSocialAccounts(db, config, ctx.now);
  // Insights first: a call that finds the token revoked flags the connection, and the cards below must show that.
  const insights = Object.fromEntries(
    await Promise.all(
      stored.filter((a) => a.connection?.status === "connected").map(async (a) => [a.provider, await loadInsights(db, api, a.provider, ctx.now)] as const),
    ),
  ) as Partial<Record<SocialProviderKey, InsightsResult>>;
  const accounts = Object.keys(insights).length > 0 ? await listSocialAccounts(db, config, ctx.now) : stored;
  const choice = chooseId ? await pendingPageChoice(db, chooseId, ctx.user.id, ctx.now) : null;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {isConnectResult(result) && (
        <Notice tone={result === "connected" ? "success" : "error"} className="mt-6">
          {format(t.results[result], { provider: isSocialProvider(resultProvider) ? t.providers[resultProvider].title : t.genericAccount })}
        </Notice>
      )}

      {chooseId && (
        <Section id={`social-choose-${locale}`} title={t.choose.title} lead={t.choose.lead}>
          {choice ? (
            <ActionForm action={choosePageAction} className="max-w-xl" showSuccess={false}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="pendingId" value={chooseId} />
              <fieldset>
                <legend className="sr-only">{t.choose.title}</legend>
                <ul className="divide-y divide-line border-y border-line">
                  {choice.map((page, i) => (
                    <li key={page.id}>
                      <label className="flex cursor-pointer items-start gap-3 py-3 text-sm">
                        <input type="radio" name="pageId" value={page.id} defaultChecked={i === 0} className="mt-1 accent-ink" />
                        <span className="min-w-0">
                          <span className="block font-medium">{page.name}</span>
                          <span className="block text-xs text-muted">
                            {[page.category, page.canAnalyze ? null : t.choose.noAnalyze].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div className="mt-5">
                <SubmitButton pendingLabel={t.connecting}>{t.choose.submit}</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <Notice tone="error">{t.choose.expired}</Notice>
          )}
        </Section>
      )}

      <Section id={`social-accounts-${locale}`} title={t.accountsTitle} lead={t.accountsLead}>
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.provider} locale={locale} dict={dict} account={account} timeZone={ctx.timeZone} />
          ))}
        </div>
      </Section>

      <Section id={`social-insights-${locale}`} title={t.insights.title} lead={t.insights.lead}>
        {accounts.some((a) => a.connection) ? (
          <div className="space-y-12">
            {accounts.map((a) =>
              a.connection ? (
                <InsightsPanel key={a.provider} locale={locale} dict={dict} provider={a.provider} result={insights[a.provider]} timeZone={ctx.timeZone} />
              ) : null,
            )}
          </div>
        ) : (
          <EmptyState>{t.insights.empty}</EmptyState>
        )}
      </Section>

      <Section id={`social-setup-${locale}`} title={t.setup.title} lead={t.setup.lead}>
        <div className="grid gap-8 lg:grid-cols-2">
          {accounts.map((a) => (
            <SetupDetails key={a.provider} dict={dict} account={a} />
          ))}
        </div>
      </Section>
    </>
  );
}

function AccountCard({ locale, dict, account, timeZone }: { locale: Locale; dict: Dictionary; account: SocialAccountView; timeZone: string }) {
  const t = dict.admin.social;
  const p = t.providers[account.provider];
  const c = account.connection;
  const status = !c ? (account.configured ? "notConnected" : "notConfigured") : c.status === "connected" ? "connected" : "needsReconnect";
  const when = (date: Date | null) => (date ? dateTime(date, timeZone, locale, dict) : null);

  return (
    <article aria-labelledby={`social-${account.provider}-${locale}`} className="flex min-w-0 flex-col border-t border-line-strong pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`social-${account.provider}-${locale}`} className="font-semibold tracking-tight">
          {p.title}
        </h3>
        <Tag tone={status === "connected" ? "solid" : status === "needsReconnect" ? "danger" : "default"}>{t.statuses[status]}</Tag>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{p.eligibility}</p>

      {!account.configured && (
        <Notice className="mt-4">
          {format(t.notConfigured, { vars: account.missingEnv.join(", ") })}
        </Notice>
      )}

      {c && c.status === "needs_reconnect" && c.problem && (
        <Notice tone="error" className="mt-4">
          {t.problems[c.problem]}
        </Notice>
      )}

      {c && (
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">{t.fields.account}</dt>
          <dd className="min-w-0 break-words">
            {c.profileUrl ? (
              <a href={c.profileUrl} target="_blank" rel="noopener noreferrer" className={cn(textLink, "inline-flex items-center gap-1")}>
                {c.username ? `@${c.username}` : c.name}
                <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
              </a>
            ) : (
              c.name
            )}
            {c.username && c.name !== c.username && <span className="block text-xs text-muted">{c.name}</span>}
          </dd>
          {c.accountType && (
            <>
              <dt className="text-muted">{t.fields.accountType}</dt>
              <dd>{t.accountTypes[c.accountType as keyof typeof t.accountTypes] ?? c.accountType}</dd>
            </>
          )}
          <dt className="text-muted">{t.fields.permissions}</dt>
          <dd className="min-w-0">
            <ul className="flex flex-wrap gap-1.5">
              {[...account.requested.required, ...account.requested.optional].map((scope) => {
                const granted = c.grantedScopes.includes(scope);
                return (
                  <li key={scope}>
                    <Tag tone={granted ? "default" : "missing"}>
                      <span className="sr-only">{granted ? t.fields.granted : t.fields.notGranted}: </span>
                      {scope}
                    </Tag>
                  </li>
                );
              })}
            </ul>
            {c.status === "connected" && c.missingOptional.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted">{format(t.optionalMissing, { scopes: c.missingOptional.join(", ") })}</p>
            )}
          </dd>
          <dt className="text-muted">{t.fields.connected}</dt>
          <dd className="tabular">{c.connectedBy ? format(t.fields.connectedBy, { date: when(c.connectedAt)!, name: c.connectedBy }) : when(c.connectedAt)}</dd>
          {c.status === "connected" && (
            <>
              <dt className="text-muted">{t.fields.tokenExpires}</dt>
              <dd className="tabular">{when(c.tokenExpiresAt) ?? t.fields.noExpiry}</dd>
              {c.dataAccessExpiresAt && (
                <>
                  <dt className="text-muted">{t.fields.dataAccess}</dt>
                  <dd className="tabular">{when(c.dataAccessExpiresAt)}</dd>
                </>
              )}
            </>
          )}
          <dt className="text-muted">{t.fields.lastChecked}</dt>
          <dd className="tabular">{when(c.lastCheckedAt) ?? t.fields.never}</dd>
        </dl>
      )}

      <div className="mt-6 flex flex-wrap items-start gap-2">
        {account.configured && (!c || c.status === "needs_reconnect") && (
          <ConnectForm locale={locale} provider={account.provider} label={c ? t.reconnect : t.connect} pendingLabel={t.redirecting} />
        )}
        {c?.status === "connected" && (
          <ActionForm action={checkConnectionAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="provider" value={account.provider} />
            <SubmitButton variant="secondary" pendingLabel={t.checking}>
              {t.check}
            </SubmitButton>
          </ActionForm>
        )}
        {c?.status === "connected" && account.configured && (
          <ConnectForm locale={locale} provider={account.provider} label={t.reconnect} pendingLabel={t.redirecting} variant="secondary" />
        )}
        {c && (
          <DisconnectSocialButton
            locale={locale}
            provider={account.provider}
            labels={{ disconnect: t.disconnect, close: dict.admin.common.close, title: format(t.disconnectTitle, { provider: p.title }), body: t.disconnectBody, revokeHint: p.revokeHint }}
          />
        )}
      </div>
    </article>
  );
}

function ConnectForm({
  locale,
  provider,
  label,
  pendingLabel,
  variant = "primary",
}: {
  locale: Locale;
  provider: SocialProviderKey;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <ActionForm action={startConnectionAction} showSuccess={false}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="provider" value={provider} />
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

function InsightsPanel({
  locale,
  dict,
  provider,
  result,
  timeZone,
}: {
  locale: Locale;
  dict: Dictionary;
  provider: SocialProviderKey;
  result: InsightsResult | undefined;
  timeZone: string;
}) {
  const t = dict.admin.social.insights;
  const title = dict.admin.social.providers[provider].title;
  const id = `social-insights-${provider}-${locale}`;

  if (!result || result.state !== "ok") {
    const key = !result || result.state === "needs_reconnect" || result.state === "not_connected" ? "needsReconnect" : result.state === "rate_limited" ? "rateLimited" : "unavailable";
    return (
      <section aria-labelledby={id}>
        <h3 id={id} className="font-semibold tracking-tight">
          {title}
        </h3>
        <Notice className="mt-4">{t[key]}</Notice>
      </section>
    );
  }

  const value = (v: number | null) => (v === null ? "—" : count(v, locale));
  const profileTiles: { label: string; value: number | null }[] =
    provider === "facebook"
      ? [
          { label: t.followers, value: result.followers },
          { label: t.likes, value: result.likes },
        ]
      : [
          { label: t.followers, value: result.followers },
          { label: t.mediaCount, value: result.mediaCount },
        ];

  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="font-semibold tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted tabular">{format(t.asOf, { time: dateTime(result.fetchedAt, timeZone, locale, dict) })}</p>
      </div>

      <h4 className="mt-5 eyebrow text-muted">{t.profile}</h4>
      <StatGroup className="mt-3 grid-cols-2 sm:grid-cols-4">
        {profileTiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={value(tile.value)} tone={tile.value === null ? "muted" : "default"} />
        ))}
      </StatGroup>

      <h4 className="mt-8 eyebrow text-muted">{format(t.period, { days: 28 })}</h4>
      {!result.insightsGranted && <Notice className="mt-3">{t.notGranted[provider]}</Notice>}
      <StatGroup className="mt-3 grid-cols-2 sm:grid-cols-4">
        {result.metrics.map((m) => (
          <StatTile
            key={m.key}
            label={t.metrics[m.key]}
            value={m.state === "ok" ? value(m.value) : "—"}
            tone={m.state === "ok" ? "default" : "muted"}
            hint={m.state === "ok" ? undefined : t.states[m.state]}
          />
        ))}
      </StatGroup>
      <p className="mt-3 text-xs leading-relaxed text-muted">{t.metricsNote[provider]}</p>

      <h4 className="mt-8 eyebrow text-muted">{t.posts}</h4>
      {result.posts === null ? (
        <p className="mt-3 text-sm text-muted">{t.postsUnavailable}</p>
      ) : result.posts.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.noPosts}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {result.posts.map((post) => (
            <li key={post.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-baseline sm:gap-4">
              <span className="shrink-0 text-xs text-muted tabular sm:w-36">{post.createdAt ? dateTime(new Date(post.createdAt), timeZone, locale, dict) : "—"}</span>
              <span className="min-w-0 flex-1 break-words">{post.text || t.untitledPost}</span>
              {(post.likes != null || post.comments != null) && (
                <span className="shrink-0 text-xs text-muted tabular">
                  {format(t.reactions, { likes: post.likes ?? 0, comments: post.comments ?? 0 })}
                </span>
              )}
              {post.permalink && (
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={cn(textLink, "shrink-0 text-xs")}>
                  {t.openPost}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SetupDetails({ dict, account }: { dict: Dictionary; account: SocialAccountView }) {
  const t = dict.admin.social.setup;
  const p = dict.admin.social.providers[account.provider];
  const reasons = dict.admin.social.scopeReasons;
  return (
    <div className="min-w-0 text-sm">
      <h3 className="font-semibold tracking-tight">{p.title}</h3>
      <dl className="mt-3 space-y-3">
        <div>
          <dt className="text-muted">{t.callback}</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">{account.redirectUri ?? t.needsOrigin}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.deauthorize}</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">{account.deauthorizeUri ?? t.needsOrigin}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.requested}</dt>
          <dd className="mt-1">
            <ul className="space-y-1.5">
              {[...account.requested.required.map((s) => [s, true] as const), ...account.requested.optional.map((s) => [s, false] as const)].map(([scope, required]) => (
                <li key={scope}>
                  <span className="font-mono text-xs">{scope}</span>{" "}
                  <span className="text-xs text-muted">
                    ({required ? t.required : t.optional}) {reasons[scope as keyof typeof reasons]}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted">{t.docs}</p>
    </div>
  );
}

