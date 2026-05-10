import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;
  return (
    <>
      {message === "account_deleted" && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-herb-light text-herb text-sm text-center">
          Your account has been deleted. Sorry to see you go.
        </div>
      )}
      {error === "auth_callback_failed" && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm text-center">
          Verification link expired or already used. Please sign in or sign up again.
        </div>
      )}
      <LoginForm />
    </>
  );
}
