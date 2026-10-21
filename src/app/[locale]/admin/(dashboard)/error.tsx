"use client";

import { useAdminStrings } from "@/components/admin/form";
import { EmptyState, smallButton } from "@/components/admin/ui";

/** A dashboard section failed to render. Nothing was changed; offer a retry. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useAdminStrings().common;
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div role="alert" className="py-10">
      <EmptyState>
        <p className="font-semibold text-ink">{t.errorTitle}</p>
        <p className="mt-1">{t.errorBody}</p>
        {digest && <p className="tabular mt-2 text-xs text-taupe">{digest}</p>}
        <button type="button" onClick={() => retry()} className={`${smallButton} mt-4`}>
          {t.retry}
        </button>
      </EmptyState>
    </div>
  );
}
