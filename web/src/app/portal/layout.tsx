import Providers from "@/app/providers";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
