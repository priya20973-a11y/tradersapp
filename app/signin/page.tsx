import { AuthForm } from "@/components/auth/auth-form";
import { connection } from "next/server";

export default async function SignInPage() {
  await connection();

  return <AuthForm mode="signin" />;
}
