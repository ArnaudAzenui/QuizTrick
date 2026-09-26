import { AuthForm } from "@frontend/components/AuthForm";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AuthForm mode="login" next={typeof params.next === "string" ? params.next : undefined}
    linkError={typeof params.error === "string" ? params.error : undefined} />;
}
