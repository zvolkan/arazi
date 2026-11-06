"use client";

import { useFormStatus } from "react-dom";

/** Silme gibi işlemlerden önce onay ister. Bir <form> içinde kullanılır. */
export function ConfirmButton({
  message,
  children,
  className = "btn btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
