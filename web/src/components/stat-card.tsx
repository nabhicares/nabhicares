interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warning" | "danger" | "success";
}

const toneClass: Record<string, string> = {
  default: "bg-white border-[#E5E8EF]",
  warning: "bg-amber-50 border-amber-200",
  danger: "bg-red-50 border-red-200",
  success: "bg-emerald-50 border-emerald-200",
};

const valueClass: Record<string, string> = {
  default: "text-[#0D1B35]",
  warning: "text-amber-700",
  danger: "text-red-700",
  success: "text-emerald-700",
};

export default function StatCard({ label, value, sub, tone = "default" }: Props) {
  return (
    <div className={`rounded-2xl border p-5 ${toneClass[tone]}`}>
      <p className="text-xs font-medium text-[#6B7891] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-[#6B7891] mt-1">{sub}</p>}
    </div>
  );
}
