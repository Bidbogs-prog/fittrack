import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[radial-gradient(800px_500px_at_85%_20%,rgba(255,157,59,0.09),transparent_60%)]">
      <header className="mx-auto w-full max-w-[1200px] px-6 py-[18px]">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
