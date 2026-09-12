import { LocalizedText } from "@/components/language-provider";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthGate from "@/components/auth-gate";

export const dynamic = "force-dynamic";

export default function Login() {
  if (!process.env.WIDA_API_URL) redirect("/");
  return <Suspense fallback={<div className="app-loading"><LocalizedText message="Ouverture de Wida…" /></div>}><AuthGate loginPage /></Suspense>;
}
