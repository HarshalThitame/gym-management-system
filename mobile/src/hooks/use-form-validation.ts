import { useCallback } from "react";
import { Alert } from "react-native";
import type { ZodSchema, ZodError } from "zod";

type ValidationResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
  fieldErrors: Record<string, string>;
};

export function useFormValidation() {
  const validate = useCallback(<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> => {
    const result = schema.safeParse(data);

    if (result.success) {
      return { ok: true, data: result.data };
    }

    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }

    const firstError = result.error.issues[0]?.message ?? "Validation failed";

    return {
      ok: false,
      error: firstError,
      fieldErrors,
    };
  }, []);

  const validateAndAlert = useCallback(<T>(schema: ZodSchema<T>, data: unknown): T | null => {
    const result = validate(schema, data);
    if (!result.ok) {
      Alert.alert("Validation Error", result.error);
      return null;
    }
    return result.data;
  }, [validate]);

  return { validate, validateAndAlert };
}
