import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Iniciar sesión</h1>
      <p className="mb-6 text-sm text-muted">Entra para gestionar tus ligas y draftear.</p>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
