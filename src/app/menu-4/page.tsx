import { redirect } from "next/navigation";

type LegacyMenu4PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Menu4Page({ searchParams }: LegacyMenu4PageProps) {
  const currentSearchParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(currentSearchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  redirect(`/recommendations${queryString ? `?${queryString}` : ""}`);
}
