import { Suspense } from "react";
import { AuthCallback } from "@/components/auth/AuthCallback";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
          <p className="text-sm text-muted">Signing you in...</p>
        </main>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
