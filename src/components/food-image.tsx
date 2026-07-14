import { ForkKnife } from "@phosphor-icons/react/dist/ssr";

/**
 * Food thumbnail with a graceful placeholder. Plain <img> keeps us free of
 * remote-domain config for arbitrary Supabase storage URLs.
 */
export function FoodImage({
  src,
  alt,
  className = "size-14 rounded-lg",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <span className={`${className} grid shrink-0 place-items-center bg-ink-800 text-paper-mute`}>
        <ForkKnife className="size-[38%]" weight="duotone" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={`${className} shrink-0 object-cover`} />
  );
}
