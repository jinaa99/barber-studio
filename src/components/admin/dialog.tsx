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

// Entrance animation and backdrop live in globals.css (`dialog[open]`, `dialog::backdrop`).
const panelBase =
  "m-auto max-h-[min(100dvh-2rem,56rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_32px_80px_-24px_rgb(18_18_17/0.45)]";
const panel = `${panelBase} w-[min(100%-2rem,40rem)]`;
const widePanel = `${panelBase} w-[min(100%-2rem,60rem)]`;

function DialogHeader({ title, titleId, closeLabel, onClose }: { title: ReactNode; titleId: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-sm sm:px-6">
      <h2 id={titleId} className="min-w-0 text-lg font-medium tracking-[-0.02em]">
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-stone hover:text-ink">
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
        // "close" fires asynchronously. After a remount (React's dev double-mount, or an
        // <Activity> coming back) a stale event can arrive once the dialog is open again: ignore it.
        if (!closing.current && !ref.current?.open) router.replace(closeHref, { scroll: false });
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
