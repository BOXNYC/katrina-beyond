"use client";

import { useState } from "react";
import helpAgent from "@/lib/helpAgent";

export type AgentAction = {
  label: string;
  onClick: () => void;
  secondary?: boolean;
};

/**
 * Optional helper that sits in the corner of every experience. Players can ask
 * for a hint any time, and the experience can also have the agent speak up
 * (`alert`). Remount it with a new `key` when the situation changes so the tip
 * list starts over.
 */
export default function HelpAgent({
  tips,
  alert,
}: {
  /** Ranked from most to least useful. */
  tips: string[];
  /** Something the agent says on its own, with optional buttons. */
  alert?: { text: string; actions?: AgentAction[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const showingAlert = !!alert;
  const bubbleOpen = showingAlert || open;
  const tip = tips[index];

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-w-md flex-col items-end gap-3"
      aria-live="polite"
    >
      {bubbleOpen && (
        <div className="rounded-2xl border-2 border-amber-300 bg-white p-5 text-slate-900 shadow-xl">
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-700">
            {helpAgent.name}
          </p>
          <p className="text-xl leading-snug">
            {showingAlert ? alert.text : (tip ?? helpAgent.outOfTips)}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {showingAlert
              ? alert.actions?.map((a) => (
                  <BubbleButton key={a.label} onClick={a.onClick} secondary={a.secondary}>
                    {a.label}
                  </BubbleButton>
                ))
              : (
                <>
                  {index < tips.length - 1 && (
                    <BubbleButton onClick={() => setIndex(index + 1)}>
                      {helpAgent.nextTipLabel}
                    </BubbleButton>
                  )}
                  <BubbleButton
                    secondary
                    onClick={() => {
                      setOpen(false);
                      setIndex(0);
                    }}
                  >
                    {helpAgent.closeLabel}
                  </BubbleButton>
                </>
              )}
          </div>
        </div>
      )}

      {!showingAlert && !open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 rounded-full bg-amber-300 py-2 pl-2 pr-6 text-xl font-semibold text-slate-900 shadow-lg transition-colors hover:bg-amber-200"
        >
          <Avatar />
          {helpAgent.openLabel}
        </button>
      )}
      {(showingAlert || open) && <Avatar />}
    </div>
  );
}

function Avatar() {
  if (helpAgent.avatarSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={helpAgent.avatarSrc} alt="" className="h-16 w-16 rounded-full object-cover" />;
  }
  // Placeholder badge: friendly weather-reporter silhouette.
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r="31" fill="#0ea5e9" stroke="#fff" strokeWidth="3" />
      <circle cx="32" cy="26" r="10" fill="#fde68a" />
      <path d="M12 56c2-14 12-18 20-18s18 4 20 18z" fill="#1e293b" />
      <path d="M26 40l6 8 6-8z" fill="#fff" />
    </svg>
  );
}

function BubbleButton({
  children,
  onClick,
  secondary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-14 rounded-full px-6 text-lg font-semibold transition-colors ${
        secondary
          ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
          : "bg-sky-600 text-white hover:bg-sky-500"
      }`}
    >
      {children}
    </button>
  );
}
