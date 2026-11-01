"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/lib/utils/action-result";

// Relie un formulaire à une Server Action. Les valeurs brutes sont envoyées :
// le serveur refait toujours la validation Zod, le client ne sert qu'au confort.
export function useFormAction<TInput extends FieldValues, TOutput, TData>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  action: (values: TInput) => Promise<ActionResult<TData> | void>,
  onSuccess?: (data: TData) => void,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(() => {
    setError(null);

    startTransition(async () => {
      const result = await action(form.getValues());
      if (!result) return;

      if (result.ok) {
        onSuccess?.(result.data);
        return;
      }

      for (const [field, message] of Object.entries(result.fields ?? {})) {
        form.setError(field as Path<TInput>, { message });
      }

      if (!result.fields) setError(result.error);
    });
  });

  return { submit, pending, error };
}
