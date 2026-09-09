import { Suspense } from "react";
import Workspace from "@/components/workspace";
import AuthGate from "@/components/auth-gate";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Suspense fallback={<div className="app-loading">Opening your workspace…</div>}>{process.env.WIDA_API_URL ? <AuthGate /> : <Workspace mode="demo" />}</Suspense>;
}
