import Link from "next/link";
import { LiveBlocks } from "@/components/live-blocks";
import { Logo } from "@/components/logo";

const modules = [
  ["Explorer", "Look up any wallet: balances, tokens, NFTs and history across five networks."],
  ["Monitors", "Get a Telegram message or a signed webhook the moment a watched wallet or contract moves."],
  ["Developer API", "The same data over REST, with project keys, rate limits and request logs."],
  ["Contract studio", "Deploy audited templates to testnets from your own wallet. Keys never leave it."],
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/sign-in" className="text-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md bg-ink px-3.5 py-2 font-medium text-paper hover:opacity-90">
            Create account
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-20 py-12 sm:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
              One console for everything your team does on-chain.
            </h1>
            <p className="max-w-[60ch] text-lg text-muted">
              Explore wallets, watch for activity, ship contracts and serve blockchain data to your own apps, with
              organizations and roles built in from day one.
            </p>
          </div>
          <LiveBlocks />
        </section>

        <section aria-label="Modules" className="grid gap-x-10 gap-y-8 border-t border-line pt-10 sm:grid-cols-2">
          {modules.map(([name, text]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <h2 className="font-semibold">{name}</h2>
              <p className="max-w-[48ch] text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-sm text-muted">Built with Next.js, viem and Solidity.</footer>
    </div>
  );
}
