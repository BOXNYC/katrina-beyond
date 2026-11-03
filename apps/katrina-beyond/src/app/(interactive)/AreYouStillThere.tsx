"use client";

/** Full-screen "Are you still there?" overlay driven by useIdlePrompt. Any touch on it counts as an answer. */
export default function AreYouStillThere({
  secondsLeft,
  onStay,
  title = "Are you still there?",
  buttonLabel = "I'm still here",
}: {
  secondsLeft: number;
  onStay: () => void;
  title?: string;
  buttonLabel?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={title}
      onPointerDown={onStay}
      className="fixed inset-0 z-50 flex select-none flex-col items-center justify-center gap-6 bg-slate-950/85 p-8 text-center text-white"
    >
      <h2 className="text-5xl font-semibold text-amber-300">{title}</h2>
      <p className="text-2xl text-slate-200">Starting over in {secondsLeft}...</p>
      <button onClick={onStay} className="h-16 rounded-full bg-amber-400 px-10 text-xl font-semibold text-slate-950 hover:bg-amber-300">
        {buttonLabel}
      </button>
    </div>
  );
}
