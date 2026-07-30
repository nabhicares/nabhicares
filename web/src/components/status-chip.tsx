const TONE: Record<string, string> = {
  booked: "bg-brand/10 text-brand",
  confirmed: "bg-brand/10 text-brand",
  checked_in: "bg-warning/10 text-warning",
  consultation: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-surface-muted text-muted",
  active: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  unpaid: "bg-danger/10 text-danger",
  partial: "bg-warning/10 text-warning",
};

export default function StatusChip({ label }: { label: string }) {
  const key = label?.toLowerCase?.() ?? "";
  const tone = TONE[key] ?? "bg-surface-muted text-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {label?.replaceAll("_", " ") ?? "—"}
    </span>
  );
}
