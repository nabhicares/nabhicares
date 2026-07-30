import { redirect } from "next/navigation";

/** Old More tab → Profile (Flutter parity). */
export default function PatientMoreRedirect() {
  redirect("/portal/patient/profile");
}
