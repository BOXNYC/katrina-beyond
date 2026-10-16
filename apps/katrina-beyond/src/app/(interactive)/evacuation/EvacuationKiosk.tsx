"use client";

import { useEffect, useRef, useState } from "react";
import evacuation, {
  choiceLabel,
  outcomeFor,
  type Choice,
  type DestinationId,
  type ItemId,
  type Scenario,
  type TimingId,
} from "@/lib/evacuation";
import HelpAgent from "../HelpAgent";

const { scenarios, items, destinations, timings, kits } = evacuation;

type Plan = { destination: DestinationId | null; timing: TimingId | null };

type State =
  | { phase: "idle" }
  | { phase: "facts"; scenario: Scenario; nudge: Choice | null }
  | { phase: "plan"; scenario: Scenario; plan: Plan }
  | {
      phase: "pack";
      scenario: Scenario;
      choice: Choice;
      plan: Plan;
      bag: ItemId[];
      round: number;
      selected: ItemId[];
      /** Help Agent warning awaiting a decision. */
      warning: ItemId[] | null;
    }
  | { phase: "result"; scenario: Scenario; choice: Choice; plan: Plan; bag: ItemId[] };

export default function EvacuationKiosk() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [touches, setTouches] = useState(0);
  const visit = useRef(0);

  // Back to the attract screen after inactivity.
  useEffect(() => {
    if (state.phase === "idle") return;
    const t = setTimeout(() => setState({ phase: "idle" }), evacuation.idleTimeoutMs);
    return () => clearTimeout(t);
  }, [state.phase, touches]);

  const start = () => {
    const scenario = scenarios[visit.current++ % scenarios.length];
    setState({ phase: "facts", scenario, nudge: null });
  };

  const startPacking = (scenario: Scenario, choice: Choice, plan: Plan) => {
    const kit = kits[choice];
    const extra = scenario.extraItems ?? [];
    setState({
      phase: "pack",
      scenario,
      choice,
      plan,
      bag: [...kit.duffel, ...extra],
      round: 0,
      selected: [],
      warning: null,
    });
  };

  const decide = (scenario: Scenario, choice: Choice) => {
    if (choice === "evacuate") {
      setState({ phase: "plan", scenario, plan: { destination: null, timing: null } });
    } else {
      startPacking(scenario, choice, { destination: null, timing: null });
    }
  };

  return (
    <div
      className="flex min-h-screen flex-1 select-none flex-col bg-stone-950 p-8 pb-28 text-white"
      onPointerDown={() => setTouches((n) => n + 1)}
    >
      {state.phase === "idle" && (
        <button
          onClick={start}
          className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
        >
          <span className="text-6xl font-semibold">Stay or Go?</span>
          <span className="max-w-2xl text-2xl text-amber-300">
            Check the facts, make a plan and pack your duffel.
          </span>
          <span className="text-xl text-stone-300">{evacuation.planAheadNote}</span>
          <span className="animate-pulse text-2xl text-stone-300">Touch to begin</span>
        </button>
      )}

      {state.phase === "facts" && (
        <FactsView
          scenario={state.scenario}
          nudge={state.nudge}
          onChoose={(choice) => {
            if (choice !== state.scenario.recommended) {
              setState({ ...state, nudge: state.scenario.recommended });
            } else decide(state.scenario, choice);
          }}
          onSwitch={() => decide(state.scenario, state.scenario.recommended)}
          onKeep={(choice) => decide(state.scenario, choice)}
        />
      )}

      {state.phase === "plan" && (
        <PlanView
          scenario={state.scenario}
          plan={state.plan}
          setPlan={(plan) => setState({ ...state, plan })}
          onContinue={() => startPacking(state.scenario, "evacuate", state.plan)}
        />
      )}

      {state.phase === "pack" && <PackView state={state} setState={setState} />}

      {state.phase === "result" && (
        <ResultView
          state={state}
          onAgain={start}
          onDone={() => setState({ phase: "idle" })}
        />
      )}
    </div>
  );
}

function FactsView({
  scenario,
  nudge,
  onChoose,
  onSwitch,
  onKeep,
}: {
  scenario: Scenario;
  nudge: Choice | null;
  onChoose: (c: Choice) => void;
  onSwitch: () => void;
  onKeep: (c: Choice) => void;
}) {
  const c = scenario.conditions;
  const tiles = [
    ["🌊", "Flooding", c.flooding],
    ["💨", "Wind", c.wind],
    ["⚡", "Power", c.power],
    ["🧭", "Storm track", c.track],
  ];
  const picked: Choice | null = nudge ? (nudge === "shelter" ? "evacuate" : "shelter") : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6">
      <p className="text-center text-lg uppercase tracking-widest text-amber-300">
        Step 1: Get the facts
      </p>
      <h1 className="text-center text-4xl font-semibold">{scenario.title} is on the way</h1>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(([icon, label, text]) => (
          <li key={label} className="rounded-2xl bg-stone-900 p-5 text-center">
            <p className="text-4xl">{icon}</p>
            <p className="mt-1 text-sm uppercase tracking-wide text-stone-400">{label}</p>
            <p className="text-lg">{text}</p>
          </li>
        ))}
      </ul>
      <p className="rounded-2xl border border-amber-400 bg-amber-950 p-5 text-xl">
        📻 {scenario.official}
      </p>
      <p className="text-center text-xl text-stone-300">{scenario.household}</p>
      <p className="text-center text-2xl font-semibold">What will you do?</p>
      <div className="grid gap-4 md:grid-cols-2">
        {(["shelter", "evacuate"] as const).map((choice) => (
          <button
            key={choice}
            disabled={!!nudge}
            onClick={() => onChoose(choice)}
            className="rounded-2xl bg-stone-900 p-6 text-left transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            <span className="text-3xl font-semibold text-amber-300">
              {choice === "shelter" ? "🏠 Shelter in place" : "🚗 Evacuate"}
            </span>
            <span className="mt-1 block text-lg text-stone-300">
              {choice === "shelter"
                ? "Stay home and ride out the storm safely."
                : "Leave the area before the storm arrives."}
            </span>
          </button>
        ))}
      </div>
      <HelpAgent
        key={nudge ?? "facts"}
        tips={[
          "Read each box: flooding, wind, power and storm track.",
          "Read the official message. It tells you what local leaders want you to do.",
          "Not every storm means leaving. Look at the facts for your area.",
        ]}
        alert={
          nudge && picked
            ? {
                text: `Take another look at the facts. ${scenario.why} Officials suggest you ${
                  nudge === "shelter" ? "shelter in place" : "evacuate"
                }.`,
                actions: [
                  { label: `Switch to ${choiceLabel(nudge)}`, onClick: onSwitch },
                  { label: "Keep my choice", onClick: () => onKeep(picked), secondary: true },
                ],
              }
            : null
        }
      />
    </div>
  );
}

function PlanView({
  scenario,
  plan,
  setPlan,
  onContinue,
}: {
  scenario: Scenario;
  plan: Plan;
  setPlan: (p: Plan) => void;
  onContinue: () => void;
}) {
  const dest = plan.destination ? destinations[plan.destination] : null;
  const timing = plan.timing ? timings[plan.timing] : null;
  const destGood = plan.destination && scenario.goodDestinations.includes(plan.destination);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6">
      <p className="text-center text-lg uppercase tracking-widest text-amber-300">
        Step 2: Make your plan
      </p>
      <h1 className="text-center text-3xl font-semibold">Where will you go, and when?</h1>
      <p className="text-center text-xl text-stone-300">{scenario.household}</p>

      <h2 className="text-xl font-semibold">Where will you go?</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(destinations) as DestinationId[]).map((id) => (
          <OptionCard
            key={id}
            on={plan.destination === id}
            icon={destinations[id].icon}
            label={destinations[id].label}
            note={destinations[id].note}
            onClick={() => setPlan({ ...plan, destination: id })}
          />
        ))}
      </div>
      {dest && (
        <p className="text-xl text-sky-300">
          {destGood ? dest.praise : `${dest.praise} ${scenario.destinationTip}`.trim()}
        </p>
      )}

      <h2 className="text-xl font-semibold">When will you leave?</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(timings) as TimingId[]).map((id) => (
          <OptionCard
            key={id}
            on={plan.timing === id}
            icon={timings[id].icon}
            label={timings[id].label}
            note={timings[id].note}
            onClick={() => setPlan({ ...plan, timing: id })}
          />
        ))}
      </div>
      {timing && <p className="text-xl text-sky-300">{timing.praise}</p>}

      <div className="flex justify-center">
        <ActionButton disabled={!plan.destination || !plan.timing} onClick={onContinue}>
          Pack my duffel
        </ActionButton>
      </div>
      <HelpAgent
        tips={[
          "Think about how you will get there. Not everyone has a car or money for a hotel, and that's okay.",
          "Public shelters are free and open to everyone.",
          "Some community shelters run on solar power, so they can keep medical equipment running.",
          "Leaving early means clearer roads and more choices.",
        ]}
      />
    </div>
  );
}

function OptionCard({
  on,
  icon,
  label,
  note,
  onClick,
}: {
  on: boolean;
  icon: string;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
        on ? "border-amber-400 bg-amber-950" : "border-transparent bg-stone-900 hover:bg-stone-800"
      }`}
    >
      <span className="text-2xl">
        {icon} {label}
      </span>
      <span className="block text-stone-300">{note}</span>
    </button>
  );
}

function PackView({
  state,
  setState,
}: {
  state: Extract<State, { phase: "pack" }>;
  setState: (s: State) => void;
}) {
  const { scenario, choice, plan, bag, round, selected, warning } = state;
  const kit = kits[choice];
  const current = kit.rounds[round];
  const remaining = current.remove - selected.length;

  const toggle = (id: ItemId) => {
    if (warning) return;
    const isSel = selected.includes(id);
    if (!isSel && remaining === 0) return;
    setState({
      ...state,
      selected: isSel ? selected.filter((s) => s !== id) : [...selected, id],
    });
  };

  const advance = (removed: ItemId[]) => {
    const nextBag = bag.filter((b) => !removed.includes(b));
    if (round + 1 >= kit.rounds.length) {
      setState({ phase: "result", scenario, choice, plan, bag: nextBag });
    } else {
      setState({ ...state, bag: nextBag, round: round + 1, selected: [], warning: null });
    }
  };

  const confirm = () => {
    const risky = selected.filter(
      (id) => kit.advice[id] && !current.skipAdvice?.includes(id),
    );
    if (risky.length) setState({ ...state, warning: risky });
    else advance(selected);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-amber-300">
          Step {choice === "evacuate" ? 3 : 2}: Pack your duffel · {choiceLabel(choice)}
        </h1>
        <span className="text-lg text-stone-400">
          Round {round + 1} of {kit.rounds.length}
        </span>
      </div>
      <p className="text-2xl leading-relaxed">{current.prompt}</p>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {bag.map((id) => {
          const item = items[id];
          const sel = selected.includes(id);
          return (
            <li key={id}>
              <button
                onClick={() => toggle(id)}
                aria-pressed={sel}
                className={`flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 text-lg transition-colors ${
                  sel
                    ? "border-sky-400 bg-sky-950 text-stone-400 line-through"
                    : "border-transparent bg-stone-900 hover:bg-stone-800"
                }`}
              >
                <span className="text-5xl">{item.icon}</span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      {!warning && (
        <div className="flex items-center justify-center gap-6">
          <span className="text-xl text-stone-300">
            {remaining > 0 ? `Choose ${remaining} more to take out` : "Ready to take out"}
          </span>
          <ActionButton disabled={remaining !== 0} onClick={confirm}>
            Take out selected
          </ActionButton>
        </div>
      )}

      <HelpAgent
        key={`${round}-${warning ? "warn" : "tips"}`}
        tips={[
          "Pets, ID, food and a way to get news come first.",
          "Sentimental things matter, but people and pets cannot be replaced.",
          "Silly extras like gum and trophies can stay home.",
          "Tap an item to select it. Tap it again to put it back.",
        ]}
        alert={
          warning
            ? {
                text: warning.map((id) => `${items[id].label}: ${kit.advice[id]}`).join(" "),
                actions: [
                  {
                    label: `Keep ${warning.length > 1 ? "them" : "it"}`,
                    onClick: () =>
                      setState({
                        ...state,
                        selected: selected.filter((s) => !warning.includes(s)),
                        warning: null,
                      }),
                  },
                  { label: "Take out anyway", onClick: () => advance(selected), secondary: true },
                ],
              }
            : null
        }
      />
    </div>
  );
}

function ResultView({
  state,
  onAgain,
  onDone,
}: {
  state: Extract<State, { phase: "result" }>;
  onAgain: () => void;
  onDone: () => void;
}) {
  const { scenario, choice, plan, bag } = state;
  const kit = kits[choice];
  const core = [...kit.core, ...(scenario.extraItems ?? [])];
  const missing = core.filter((id) => !bag.includes(id));
  const outcome = outcomeFor(missing.length);
  const smart = choice === scenario.recommended;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 text-center">
      <h1 className="text-5xl font-semibold text-amber-300">{outcome.title}</h1>
      <p className="text-2xl text-stone-300">{outcome.text}</p>

      <p className="text-xl">
        {smart ? "✅ " : "💡 "}
        You chose to {choiceLabel(choice).toLowerCase()}.{" "}
        {smart ? "That fits the facts." : `Officials suggested you ${choiceLabel(scenario.recommended).toLowerCase()}. ${scenario.why}`}
      </p>
      {plan.destination && plan.timing && (
        <p className="text-lg text-stone-300">
          Your plan: {destinations[plan.destination].label.toLowerCase()}, and{" "}
          {timings[plan.timing].label.toLowerCase()}.
        </p>
      )}

      <ul className="flex flex-wrap justify-center gap-3">
        {bag.map((id) => (
          <li key={id} className="rounded-xl bg-stone-900 px-4 py-3 text-lg">
            {items[id].icon} {items[id].label}
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <ul className="space-y-1 text-lg text-sky-300">
          {missing.map((id) => (
            <li key={id}>
              💡 {items[id].label}: {kit.tips[id] ?? "Worth keeping in your kit."}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl bg-stone-900 p-5 text-left">
        <h2 className="mb-2 text-lg font-semibold text-amber-300">Remember</h2>
        <ul className="space-y-1 text-lg">
          {evacuation.takeaways.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-4">
        <ActionButton onClick={onAgain}>Try another storm</ActionButton>
        <ActionButton secondary onClick={onDone}>
          Done
        </ActionButton>
      </div>
      <HelpAgent
        tips={[
          "Great work! Try another storm to see a different set of facts.",
          "To learn more, check ready.gov and your parish emergency website.",
        ]}
      />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  secondary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-16 rounded-full px-10 text-xl font-semibold transition-colors disabled:opacity-40 ${
        secondary
          ? "bg-stone-800 text-white hover:bg-stone-700"
          : "bg-amber-400 text-stone-950 hover:bg-amber-300"
      }`}
    >
      {children}
    </button>
  );
}
