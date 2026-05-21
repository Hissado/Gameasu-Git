/**
 * Nexora — monogramme officiel.
 * - variant="light" (fond clair) : version navy + accent or sur fond transparent
 * - variant="dark"  (fond sombre) : version inversée — N blanc + accent or sur transparent
 * Plus aucune pastille de fond : le glyphe vit directement sur le support, fidèle au
 * traitement de marque (comme dans la référence fournie).
 */
export function NexoraMark({
  className = "w-10 h-10",
  variant = "light",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const src =
    variant === "dark"
      ? "/branding/nexora-mark-light.png"
      : "/branding/nexora-mark.png";
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      aria-hidden="true"
      className={`inline-block object-contain shrink-0 select-none ${className}`}
    />
  );
}
