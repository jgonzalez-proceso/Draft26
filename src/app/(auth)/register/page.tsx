import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-muted">Regístrate para crear o unirte a una liga.</p>
      <Suspense fallback={null}>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
