import Link from "next/link";
import { interactives } from "@/lib/interactives";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-10 py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Katrina &amp; Beyond
        </h1>
        <ul className="flex flex-col gap-4">
          {Object.values(interactives).map(({ info: { slug, title, description } }) => (
            <li key={slug}>
              <Link
                href={`/${slug}`}
                className="block rounded-lg border border-solid border-black/[.08] p-5 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                <h2 className="text-xl font-medium text-zinc-950 dark:text-zinc-50">
                  {title}
                </h2>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
