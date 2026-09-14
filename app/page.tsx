import { redirect } from "next/navigation";
import LandingPage from "@/components/landing-page";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // Preserve existing document bookmarks and authentication errors.
  if (params.document || params.view || params.error) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const entry of Array.isArray(value) ? value : value ? [value] : []) query.append(key, entry);
    }
    redirect(`/workspace?${query}`);
  }
  return <LandingPage apiConfigured={Boolean(process.env.WIDA_API_URL)} />;
}
