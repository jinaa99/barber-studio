import type { Locale, LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { format, formatPrice } from "@/lib/format";
import { percent, shortDate } from "@/lib/admin/format";
import type { Granularity, TrendBucket } from "@/lib/admin/metrics";
import { BarList, ColumnChart, type ColumnDatum } from "./charts";

/* Metric views shared by the overview and the analytics page. */

export function bucketLabel(bucket: TrendBucket, granularity: Granularity, locale: Locale, dict: Dictionary): string {
  if (granularity === "month") {
    const month = dict.calendar.monthsShort[Number(bucket.start.slice(5, 7)) - 1];
    return locale === "mn" ? month : `${month} ${bucket.start.slice(2, 4)}`;
  }
  return shortDate(bucket.start, locale, dict);
}

function summary(dict: Dictionary, title: string, data: ColumnDatum[]): string {
  const t = dict.admin.analytics;
  const top = data.reduce<ColumnDatum | null>((best, d) => (!best || d.value > best.value ? d : best), null);
  if (!top || top.value === 0) return format(t.chartEmpty, { title });
  return format(t.chartSummary, { title, count: data.length, max: top.display, label: top.label });
}

function periodHeading(dict: Dictionary, granularity: Granularity) {
  const t = dict.admin.analytics;
  return granularity === "day" ? t.byDay : granularity === "week" ? t.byWeek : t.byMonth;
}

export function RevenueTrend({
  dict,
  locale,
  trend,
  title,
}: {
  dict: Dictionary;
  locale: Locale;
  trend: { granularity: Granularity; buckets: TrendBucket[] };
  title: string;
}) {
  const data = trend.buckets.map((b) => ({
    key: b.start,
    label: bucketLabel(b, trend.granularity, locale, dict),
    value: b.completedRevenue,
    display: formatPrice(b.completedRevenue, locale),
  }));
  return (
    <ColumnChart
      title={title}
      summary={summary(dict, title, data)}
      data={data}
      tableLabel={dict.admin.analytics.showTable}
      periodLabel={periodHeading(dict, trend.granularity)}
      valueLabel={dict.admin.analytics.revenue}
    />
  );
}

/** Appointments that weren't cancelled, by the day they take place. */
export function BookingTrend({
  dict,
  locale,
  trend,
  title,
}: {
  dict: Dictionary;
  locale: Locale;
  trend: { granularity: Granularity; buckets: TrendBucket[] };
  title: string;
}) {
  const data = trend.buckets.map((b) => {
    const value = b.appointments - b.cancelled;
    return { key: b.start, label: bucketLabel(b, trend.granularity, locale, dict), value, display: String(value) };
  });
  return (
    <ColumnChart
      title={title}
      summary={summary(dict, title, data)}
      data={data}
      tableLabel={dict.admin.analytics.showTable}
      periodLabel={periodHeading(dict, trend.granularity)}
      valueLabel={dict.admin.analytics.appointments}
    />
  );
}

export function UtilizationList({
  dict,
  locale,
  barbers,
  label,
}: {
  dict: Dictionary;
  locale: Locale;
  barbers: { barberId: string; utilization: number | null; bookedMinutes: number; scheduledMinutes: number; barber: { name: unknown } | null }[];
  label: string;
}) {
  const t = dict.admin;
  const h = (m: number) => `${Number.isInteger(m / 60) ? m / 60 : (m / 60).toFixed(1)}`;
  return (
    <BarList
      label={label}
      max={1}
      data={barbers.map((b) => ({
        key: b.barberId,
        label: b.barber ? (b.barber.name as LocalizedText)[locale] : b.barberId,
        value: b.utilization ?? 0,
        display: percent(b.utilization),
        detail:
          b.scheduledMinutes > 0
            ? `${t.analytics.bookedHours}: ${h(b.bookedMinutes)} / ${h(b.scheduledMinutes)} ${t.common.hours}`
            : t.analytics.noSchedule,
      }))}
    />
  );
}
