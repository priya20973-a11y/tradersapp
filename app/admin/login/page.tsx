import { AuthForm } from "@/components/auth/auth-form";

export default function AdminLoginPage() {
  return <AuthForm mode="admin" adminEmail={process.env.ADMIN_EMAIL ?? ""} />;
}
