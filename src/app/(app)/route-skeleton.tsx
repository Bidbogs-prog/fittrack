"use client";

import { usePathname } from "next/navigation";

/**
 * Route-shaped loading states. One (app)/loading.tsx boundary covers every
 * tab, so this picks the skeleton from the destination path (already
 * committed when the fallback renders). Each mirrors its page's grid so the
 * real content lands without a layout jump. Dashboard and Coach are
 * full-bleed (MainFrame adds no padding there); every other page is padded by
 * MainFrame, so those skeletons add none.
 */

const pulse = "animate-pulse bg-ink-800";
const card = "animate-pulse rounded-[20px] border border-ink-800 bg-ink-900 lg:rounded-[22px]";

function Bone({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return <span aria-hidden className={`block ${pulse} ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined} />;
}

function Card({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return <span aria-hidden className={`block ${card} ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined} />;
}

/** Eyebrow + page title, sized like the real h1. */
function Title({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Bone className="h-3 w-24 rounded" />
      <Bone className={`h-7 rounded-lg lg:h-10 ${wide ? "w-48 lg:w-72" : "w-36 lg:w-56"}`} />
    </div>
  );
}

function Rail() {
  return (
    <div className="flex flex-col gap-3.5 max-lg:hidden lg:sticky lg:top-0 lg:h-[100dvh] lg:border-s lg:border-ink-800 lg:px-5 lg:py-6">
      <Card className="h-28" />
      <Card className="h-24" delay={120} />
      <Card className="h-32" delay={240} />
      <Card className="h-40" delay={360} />
    </div>
  );
}

function Dashboard() {
  return (
    <div className="max-lg:px-[18px] max-lg:pt-2 max-lg:pb-44 lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-9 lg:border-b lg:border-ink-800 lg:px-9 lg:pt-7 lg:pb-6">
          <div className="flex items-end justify-between gap-3 lg:hidden">
            <Title />
            <Bone className="h-9 w-24 rounded-full" />
          </div>
          <span aria-hidden className="block size-[220px] animate-pulse self-center rounded-full border-[14px] border-ink-800 lg:order-first lg:size-[200px]" />
          <div className="flex min-w-0 flex-col gap-3 max-lg:hidden">
            <div className="flex items-start justify-between gap-4">
              <Title />
              <Bone className="h-9 w-24 rounded-full" />
            </div>
            <Bone className="h-14 w-[300px] rounded-lg" />
            <Bone className="h-4 w-56 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-2 lg:hidden">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="h-[72px] !rounded-2xl" delay={i * 80} />
            ))}
          </div>
        </section>
        <div className="mt-4 flex flex-1 flex-col gap-4 lg:mt-0 lg:px-9 lg:pt-5">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-20" delay={i * 120} />
          ))}
          <Card className="h-24" delay={360} />
        </div>
      </div>
      <Rail />
    </div>
  );
}

function Coach() {
  return (
    <div className="lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-[calc(100dvh-7rem)] min-w-0 flex-col max-lg:pb-40 lg:min-h-[100dvh]">
        <div className="flex items-center gap-3 border-b border-ink-800 py-2.5 ps-[18px] pe-[18px] lg:ps-9 lg:pe-9">
          <Bone className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone className="h-4 w-28 rounded" />
            <Bone className="h-3 w-40 rounded" />
          </div>
          <Bone className="h-9 w-20 rounded-full" />
        </div>
        <Bone className="mx-[18px] mt-3.5 h-9 rounded-[14px] lg:mx-9" />
        <div className="flex flex-col gap-4 px-[18px] pt-6 lg:px-9">
          <Bone className="h-12 w-3/5 self-end rounded-2xl" />
          <Bone className="h-28 w-4/5 rounded-2xl" />
          <Bone className="h-10 w-2/5 self-end rounded-2xl" />
        </div>
      </div>
      <Rail />
    </div>
  );
}

function Foods() {
  return (
    <div className="grid gap-3.5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      <div className="flex flex-col gap-1.5">
        <div className="lg:mb-[18px]">
          <Bone className="h-7 w-28 rounded-lg lg:h-10 lg:w-36" />
        </div>
        <div className="flex flex-col gap-2.5 max-lg:hidden">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Bone key={i} className="h-5 w-32 rounded" delay={i * 60} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 lg:gap-4 lg:pt-1">
        <div className="flex gap-2.5">
          <Bone className="h-12 flex-1 rounded-[14px]" />
          <Bone className="h-12 w-28 rounded-[14px] max-lg:hidden" />
        </div>
        <div className="flex gap-1.5 overflow-hidden lg:hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-8 w-20 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-3.5 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-[18px] border border-ink-800 bg-ink-900 p-2 lg:gap-2 lg:rounded-[20px] lg:p-2.5">
              <Bone className="h-[84px] rounded-xl lg:h-[120px] lg:rounded-[14px]" delay={i * 60} />
              <Bone className="h-4 w-3/4 rounded" />
              <Bone className="h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FoodDetail() {
  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <Bone className="h-4 w-16 rounded" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-[22px]">
        <Bone className="h-44 w-full rounded-[20px] lg:size-[180px]" />
        <Title wide />
      </div>
      <Card className="h-72" />
    </div>
  );
}

function History() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
      <div className="flex min-w-0 flex-col gap-4 lg:gap-[18px]">
        <Title />
        <div className="lg:rounded-[22px] lg:border lg:border-ink-800 lg:bg-ink-900 lg:p-5">
          <div className="grid grid-cols-7 gap-x-1 gap-y-2.5 lg:gap-x-2 lg:gap-y-3.5">
            {Array.from({ length: 28 }, (_, i) => (
              <Bone key={i} className="mx-auto size-10 rounded-full lg:size-14" delay={(i % 7) * 50} />
            ))}
          </div>
        </div>
        <Card className="h-56" />
      </div>
      <div className="flex flex-col gap-3.5">
        <Card className="h-40" />
        <Card className="h-32" delay={120} />
        <Card className="h-12" delay={240} />
      </div>
    </div>
  );
}

function Plans() {
  return (
    <div className="flex flex-col gap-3 lg:gap-[18px]">
      <Title />
      <div className="flex gap-1.5 lg:gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="h-44" delay={i * 80} />
        ))}
      </div>
    </div>
  );
}

function PlanDetail() {
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-3.5">
        <Bone className="h-4 w-16 rounded" />
        <div className="lg:hidden">
          <Title />
        </div>
        <span aria-hidden className="block size-[260px] animate-pulse self-center rounded-full border-[16px] border-ink-800" />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:pt-[30px]">
        <div className="max-lg:hidden">
          <Title wide />
        </div>
        <Card className="h-72 !rounded-[18px] lg:!rounded-[22px]" />
        <div className="grid grid-cols-4 gap-2 lg:gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-16 !rounded-2xl" delay={i * 80} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Account() {
  return (
    <div className="flex flex-col gap-3 lg:gap-[18px]">
      <div className="flex items-center gap-3 lg:gap-4">
        <Bone className="size-12 rounded-full lg:size-14" />
        <Bone className="h-6 w-40 rounded-lg lg:h-9 lg:w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
        <span aria-hidden className="block h-56 animate-pulse rounded-[20px] border border-flame/30 bg-flame/5 sm:row-span-2 lg:rounded-[22px]" />
        <Card className="h-[104px]" delay={120} />
        <Card className="h-[104px]" delay={240} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-36" delay={i * 80} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <Card className="h-48" />
        <Card className="h-48" delay={120} />
      </div>
    </div>
  );
}

function Recipes() {
  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <Title />
        <Bone className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="h-36 !rounded-2xl" delay={i * 80} />
        ))}
      </div>
    </div>
  );
}

function Generic() {
  return (
    <div className="flex flex-col gap-4">
      <Title />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="h-28" delay={i * 120} />
        ))}
      </div>
      <Card className="h-48" />
    </div>
  );
}

function pick(path: string) {
  const seg = path.split("/").filter(Boolean);
  const [root, second, third] = seg;
  switch (root) {
    case "dashboard":
      return <Dashboard />;
    case "coach":
      return <Coach />;
    case "history":
      return <History />;
    case "account":
      return <Account />;
    case "recipes":
      return second ? <Generic /> : <Recipes />;
    case "foods":
      if (!second) return <Foods />;
      return second !== "new" && !third ? <FoodDetail /> : <Generic />;
    case "plans":
      return second ? <PlanDetail /> : <Plans />;
    default:
      return <Generic />;
  }
}

export function RouteSkeleton({ label }: { label: string }) {
  const pathname = usePathname();
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {pick(pathname)}
    </div>
  );
}
