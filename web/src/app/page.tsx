import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardPlus,
  HeartPulse,
  PackageSearch,
  ReceiptIndianRupee,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const modules = [
    {
      icon: CalendarDays,
      title: "Appointments",
      copy: "Keep every doctor, patient, and time slot organised from one live schedule.",
    },
    {
      icon: ClipboardPlus,
      title: "Patient records",
      copy: "Give care teams a clear, connected view of visits, prescriptions, and history.",
    },
    {
      icon: PackageSearch,
      title: "Pharmacy & inventory",
      copy: "Track batches, expiry dates, purchases, and stock without switching systems.",
    },
    {
      icon: ReceiptIndianRupee,
      title: "Billing",
      copy: "Create transparent invoices and keep payments tied to the right patient journey.",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="CareFlow home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
            <HeartPulse className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">CareFlow</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          <a href="#platform" className="transition-colors hover:text-brand">
            Platform
          </a>
          <a href="#teams" className="transition-colors hover:text-brand">
            For teams
          </a>
          <a href="#about" className="transition-colors hover:text-brand">
            Why CareFlow
          </a>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Sign in
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/5 px-3.5 py-2 text-xs font-semibold text-brand">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Built for modern Indian hospitals
          </div>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.08] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">
            Better care starts with{" "}
            <span className="text-brand">better flow.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            One connected workspace for appointments, clinical records, pharmacy,
            billing, and hospital operations—so your team can focus on patients.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
            >
              Open your workspace
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href="#platform"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-6 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-surface"
            >
              Explore the platform
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
            {["Role-based access", "One patient record", "Real-time inventory"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand-soft/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-cyan-100/70 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/70 bg-surface p-4 shadow-[0_30px_90px_-35px_rgba(15,118,110,.35)] sm:p-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-soft">
                    Today at a glance
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-ink">Hospital overview</h2>
                </div>
                <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Stethoscope className="size-5" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3">
                {[
                  ["24", "Appointments"],
                  ["8", "Doctors"],
                  ["96%", "Stock ready"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl bg-surface px-3 py-4">
                    <p className="text-xl font-extrabold text-ink">{value}</p>
                    <p className="mt-1 text-[11px] text-muted">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">Next appointments</p>
                  <span className="text-xs font-semibold text-brand">Live queue</span>
                </div>
                {[
                  ["PN", "Priya Nair", "Dr. Ananya Mehta", "10:00"],
                  ["AP", "Anil Patil", "Dr. Karthik Iyer", "10:30"],
                  ["RK", "Ravi Kumar", "Dr. Sneha Reddy", "11:15"],
                ].map(([initials, patient, doctor, time], index) => (
                  <div
                    key={patient}
                    className={`flex items-center gap-3 py-3 ${
                      index ? "border-t border-border" : ""
                    }`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{patient}</p>
                      <p className="truncate text-xs text-muted">{doctor}</p>
                    </div>
                    <span className="rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink">
                      {time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-brand">
              One connected platform
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Every part of your hospital, in sync.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Replace disconnected registers and tools with one secure source of truth
              for every team.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, title, copy }) => (
              <article
                key={title}
                className="rounded-2xl border border-border bg-white p-6 transition-transform hover:-translate-y-1"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="teams" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-brand-dark p-8 text-white sm:p-10">
            <Users className="size-9 text-brand-soft" aria-hidden="true" />
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight">
              One system. The right view for every role.
            </h2>
            <p className="mt-4 leading-7 text-white/70">
              Each team gets a focused workspace without losing the shared context
              that keeps care moving.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              {["Hospital admins", "Doctors", "Front desk", "Pharmacists", "Patients", "Billing teams"].map(
                (role) => (
                  <div key={role} className="rounded-xl bg-white/7 px-4 py-3 text-white/85">
                    {role}
                  </div>
                ),
              )}
            </div>
          </div>

          <div id="about">
            <p className="text-sm font-bold uppercase tracking-widest text-brand">
              Designed around care
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Less coordination overhead. More time for patients.
            </h2>
            <div className="mt-8 space-y-6">
              {[
                ["A complete patient journey", "From booking through consultation, prescription, pharmacy, and payment."],
                ["Clear operational control", "Live visibility into queues, staff activity, medicine stock, and revenue."],
                ["Secure by role", "People see only the information and actions relevant to their responsibilities."],
              ].map(([title, copy]) => (
                <div key={title} className="flex gap-4">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-[2rem] bg-brand px-7 py-10 text-center sm:px-12 lg:flex-row lg:text-left">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Your hospital, working as one.</h2>
            <p className="mt-2 text-sm text-white/75">
              Sign in to continue to your secure CareFlow workspace.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand transition-transform hover:-translate-y-0.5"
          >
            Go to sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row lg:px-8">
          <div className="flex items-center gap-2 font-bold text-ink">
            <HeartPulse className="size-4 text-brand" aria-hidden="true" />
            CareFlow
          </div>
          <p>Unified hospital operations, built for better care.</p>
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Staff sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}
