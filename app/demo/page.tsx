import { LocalizedText } from "@/components/language-provider";
import { Suspense } from "react";
import Workspace from "@/components/workspace";

export default function Demo() {
  return <Suspense fallback={<div className="app-loading"><LocalizedText message="Ouverture de la démo…" /></div>}><Workspace mode="demo" /></Suspense>;
}
