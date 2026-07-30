"use client";

import { GithubLogo, SignOut } from "@phosphor-icons/react";
import { useState } from "react";

import { authClient } from "../lib/auth-client";

export function GithubSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="auth-action-stack">
      <button
        className="auth-button auth-button-primary"
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await authClient.signIn.social({
              provider: "github",
              callbackURL: "/dashboard",
            });
          } catch {
            setPending(false);
            setError("GitHub sign-in could not be started.");
          }
        }}
      >
        <GithubLogo aria-hidden="true" size={17} weight="regular" />
        {pending ? "Opening GitHub..." : "Continue with GitHub"}
      </button>
      {error === null ? null : <p role="alert">{error}</p>}
    </div>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      className="auth-button auth-button-secondary"
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess() {
              window.location.assign("/");
            },
          },
        });
      }}
    >
      <SignOut aria-hidden="true" size={17} weight="regular" />
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
