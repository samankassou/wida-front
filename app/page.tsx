import { Suspense } from "react";
import Workspace from "@/components/workspace";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Suspense fallback={<div className="app-loading">Opening your workspace…</div>}><Workspace mode={process.env.WIDA_API_URL ? "live" : "demo"} /></Suspense>;
}
