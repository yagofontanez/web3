import { LatestCaption, LatestGlyph, MiniChain } from "@/components/chain/live-glyph";
import { LiveBlocksProvider } from "@/components/chain/use-live-blocks";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">{children}</div>
      </div>
      <aside className="theme-dark auth-panel hidden lg:grid lg:grid-rows-[auto_1fr_auto] lg:gap-10 lg:p-12 xl:p-16">
        <p className="max-w-[30ch] text-2xl leading-snug font-medium tracking-[-0.01em]">
          Every wallet, contract and alert your team works with, in one place.
        </p>
        <LiveBlocksProvider keep={7}>
          <div className="flex items-center justify-center">
            <LatestGlyph className="w-full max-w-[24rem]" />
          </div>
          <div className="flex flex-col gap-5">
            <LatestCaption tagline="Your workspace sees it the moment it lands." />
            <MiniChain />
          </div>
        </LiveBlocksProvider>
      </aside>
    </div>
  );
}
