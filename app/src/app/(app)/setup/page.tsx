import { redirect } from "next/navigation";

// Old bookmark: company setup now lives under /admin.
export default function SetupRedirect() {
  redirect("/admin");
}
