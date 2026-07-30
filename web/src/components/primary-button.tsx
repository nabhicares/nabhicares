export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-dark"
      : variant === "danger"
        ? "bg-danger/10 text-danger hover:bg-danger/20"
        : "bg-surface-muted text-ink hover:bg-border";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
