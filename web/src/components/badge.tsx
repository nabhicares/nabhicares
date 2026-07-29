const tones: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  received: "bg-emerald-100 text-emerald-700",
  ok: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  partial: "bg-amber-100 text-amber-700",
  open: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
  low: "bg-orange-100 text-orange-700",
  out: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-500",
};

export default function Badge({ label }: { label: string }) {
  const key = (label ?? "").toLowerCase();
  const cls = tones[key] ?? "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}
