import { AuthForm } from "@/components/auth/auth-form";
import { connection } from "next/server";

export default async function AdminLoginPage() {
  await connection();

  return <AuthForm mode="admin" adminEmail={process.env.ADMIN_EMAIL ?? ""} />;
}
