// Saleor's makeMutation adds a `status` for ConfirmButton (src/hooks/makeMutation.ts,
// getMutationStatus); we use Apollo's hooks directly, so this derives the same value.
import type { ConfirmButtonTransitionState } from "../components/ConfirmButton/ConfirmButton";

interface MutationState {
  loading: boolean;
  called: boolean;
  error?: unknown;
  errors?: readonly unknown[];
}

export const getMutationStatus = ({
  loading,
  called,
  error,
  errors,
}: MutationState): ConfirmButtonTransitionState => {
  if (loading) return "loading";
  if (!called) return "default";
  if (error || (errors?.length ?? 0) > 0) return "error";
  return "success";
};
