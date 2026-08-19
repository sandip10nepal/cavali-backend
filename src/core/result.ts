/**
 * Result Monad — Standardized Success / Failure Result Container
 */

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { success: true, value };
  },

  fail<E>(error: E): Result<never, E> {
    return { success: false, error };
  },
};
