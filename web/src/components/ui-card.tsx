export default function UiCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base =
    "rounded-2xl border border-border bg-white p-4 shadow-sm " + className;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} text-left w-full hover:border-brand/40 transition-colors`}>
        {children}
      </button>
    );
  }
  return <div className={base}>{children}</div>;
}
