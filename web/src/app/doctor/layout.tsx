import { DoctorProvider } from "@/features/session/provider";
import { Shell } from "@/features/session/shell";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasUpstream = Boolean(process.env.DOCTOR_API_UPSTREAM_URL);
  return (
    <DoctorProvider mode={hasUpstream ? "real" : "demo"}>
      <Shell>{children}</Shell>
    </DoctorProvider>
  );
}
