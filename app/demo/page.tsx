import { Suspense } from "react";
import Workspace from "@/components/workspace";

export default function Demo() {
  return <Suspense fallback={<div className="app-loading">Ouverture de la démo…</div>}><Workspace mode="demo" /></Suspense>;
}
