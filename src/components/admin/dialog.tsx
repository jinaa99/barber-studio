"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { smallButton } from "./ui";

/*
 * Accessible dialogs on the native <dialog> element: `showModal()` gives focus
 * containment, Escape to close, an inert background and focus return, with
 * no extra dependency.
 */

const panelBase =
  "m-auto max-h-[min(100dvh-2rem,56rem)] overflow-y-auto border border-line-strong bg-paper p-0 text-ink shadow-[0_24px_80px_-24px_rgb(22_21_19/0.35)] backdrop:bg-ink/40";
const panel = `${panelBase} w-[min(100%-2rem,40rem)]`;
const widePanel = `${panelBase} w-[min(100%-2rem,60rem)]`;

function DialogHeader({ title, titleId, closeLabel, onClose }: { title: ReactNode; titleId: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper px-5 py-4 sm:px-6">
      <h2 id={titleId} className="min-w-0 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-paper-deep">
        <X aria-hidden className="size-4.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * A dialog whose open state lives in the URL (e.g. `?open=<id>`), so it can be
 * linked to and survives a refresh. Closing navigates to `closeHref`.
 * Rendered open on the server, so its content is readable before hydration.
 */
export function RouteDialog({
  title,
  closeHref,
  closeLabel,
  wide,
  children,
}: {
  title: ReactNode;
  closeHref: string;
  closeLabel: string;
  /** Room for a two-column layout (e.g. a media preview beside its details). */
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  const closing = useRef(false);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Upgrade the server-rendered (non-modal) dialog to a modal one. Removing
    // the attribute doesn't fire "close".
    dialog.removeAttribute("open");
    dialog.showModal();
    closing.current = false;
    return () => {
      // Hidden by navigation (kept alive in an <Activity>): close quietly.
      closing.current = true;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      open
      aria-labelledby={titleId}
      className={wide ? widePanel : panel}
      onClose={() => {
        if (!closing.current) router.replace(closeHref, { scroll: false });
      }}
    >
      <DialogHeader title={title} titleId={titleId} closeLabel={closeLabel} onClose={() => ref.current?.close()} />
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </dialog>
  );
}

/**
 * A button that opens a small modal, e.g. to confirm a cancellation. `children`
 * receives `close` so a form inside can dismiss it after success.
 */
export function DialogTrigger({
  label,
  title,
  closeLabel,
  triggerClassName,
  children,
}: {
  label: ReactNode;
  title: ReactNode;
  closeLabel: string;
  triggerClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Never come back open from a hidden <Activity>.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(triggerClassName ?? smallButton)} aria-haspopup="dialog">
        {label}
      </button>
      <dialog ref={ref} aria-labelledby={titleId} className={`${panelBase} w-[min(100%-2rem,28rem)]`} onClose={() => setOpen(false)}>
        {open && (
          <>
            <DialogHeader title={title} titleId={titleId} closeLabel={closeLabel} onClose={() => setOpen(false)} />
            <div className="px-5 py-5 sm:px-6">{children(() => setOpen(false))}</div>
          </>
        )}
      </dialog>
    </>
  );
}
