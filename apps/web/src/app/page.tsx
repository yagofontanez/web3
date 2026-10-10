import Link from "next/link";
import type { ReactNode } from "react";
import { BlockStrip } from "@/components/chain/block-strip";
import { LiveGlyph } from "@/components/chain/live-glyph";
import { LiveBlocksProvider } from "@/components/chain/use-live-blocks";
import { ApiArtifact, ExplorerArtifact, MonitorArtifact, StudioArtifact } from "@/components/landing/showcase";
import { Logo } from "@/components/logo";

const features: { name: string; text: string; artifact: ReactNode }[] = [
  {
    name: "Explorer",
    text: "Look up any wallet and see balances, tokens, NFTs and history across Ethereum, Base, Polygon, Arbitrum and Optimism.",
    artifact: <ExplorerArtifact />,
  },
  {
    name: "Monitors",
    text: "Describe what matters, like a large transfer or a contract event, and get told the moment it happens.",
    artifact: <MonitorArtifact />,
  },
  {
    name: "Developer API",
    text: "Serve the same data to your own apps with project keys, rate limits and a log of every request.",
    artifact: <ApiArtifact />,
  },
  {
    name: "Contract studio",
    text: "Start from audited templates, compile in the browser and deploy to a testnet from your own wallet.",
    artifact: <StudioArtifact />,
  },
];

export default function Home() {
  return (
    <LiveBlocksProvider keep={8}>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
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

        <main className="flex flex-1 flex-col">
          <section className="grid items-center gap-12 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-24">
            <div className="flex flex-col gap-7">
              <h1 className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.25rem]">
                The console for teams that build on-chain.
              </h1>
              <p className="max-w-[54ch] text-lg leading-relaxed text-muted">
                Look up any wallet, get alerted when funds move, serve chain data through your own API keys and deploy
                contracts from your wallet. One workspace, with roles and an audit trail for everyone on your team.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/sign-up" className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper hover:opacity-90">
                  Create your workspace
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-md border border-line bg-surface px-5 py-3 text-sm font-medium hover:border-muted"
                >
                  Sign in with a wallet
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <LiveGlyph />
            </div>
          </section>

          <section aria-labelledby="chain" className="flex flex-col gap-5 border-y border-line py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chain" className="font-semibold">
                Latest blocks on Base
              </h2>
              <p className="text-sm text-muted">Each pattern is its block&apos;s hash. No two are alike.</p>
            </div>
            <BlockStrip />
          </section>

          <section aria-label="What you can do" className="flex flex-col gap-20 py-20 sm:py-28">
            {features.map((f, i) => (
              <div
                key={f.name}
                className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}
              >
                <div className="flex flex-col gap-3">
                  <h2 className="text-3xl font-semibold tracking-[-0.02em]">{f.name}</h2>
                  <p className="max-w-[46ch] text-lg leading-relaxed text-muted">{f.text}</p>
                </div>
                <div className="min-w-0">{f.artifact}</div>
              </div>
            ))}
          </section>

          <section className="theme-dark deep-surface -mx-4 mb-16 flex flex-col items-start gap-6 rounded-none px-6 py-14 sm:mx-0 sm:rounded-2xl sm:px-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-balance">Bring your team on-chain this week.</h2>
              <p className="text-muted">Free while in early access. Your keys never leave your wallet.</p>
            </div>
            <Link href="/sign-up" className="shrink-0 rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper hover:opacity-90">
              Create your workspace
            </Link>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-sm text-muted">
          <Logo />
          <span>Built with Next.js, viem and Solidity.</span>
        </footer>
      </div>
    </LiveBlocksProvider>
  );
}
