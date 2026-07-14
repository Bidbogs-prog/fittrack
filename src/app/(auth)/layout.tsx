import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blueprint relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-[-10%] size-[560px] rounded-full bg-lime/[0.06] blur-[110px]"
      />
      <header className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-6">
        <Logo />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
