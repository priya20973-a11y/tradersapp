import { AuthForm } from "@/components/auth/auth-form";
import { connection } from "next/server";

export const instant = false;

export default async function SignInPage() {
  await connection();

  return <AuthForm mode="signin" />;
}
