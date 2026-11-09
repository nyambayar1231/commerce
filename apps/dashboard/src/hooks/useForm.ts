// Adapted from saleor-dashboard: src/hooks/useForm/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The part of Saleor's useForm that dialogs need: data, change, set, reset and a guarded submit.
// Saleor's exit-form-dialog wiring (`confirmLeave`, dirty tracking), toggles, field errors and
// prop merging arrive with the first page form that needs them (M2.1.4).
import { useRef, useState } from "react";

export interface ChangeEvent<TData = unknown> {
  target: {
    name: string;
    value: TData;
  };
}

export type SubmitPromise<TData = unknown> = Promise<TData>;

export type FormChange<T = unknown> = (event: ChangeEvent<T>, cb?: () => void) => void;

export interface UseFormResult<TData> {
  data: TData;
  change: FormChange;
  set: (data: Partial<TData>) => void;
  reset: () => void;
  submit: () => Promise<unknown>;
  isSubmitting: boolean;
}

function useForm<T extends object, TErrors>(
  initialData: T,
  onSubmit?: (data: T) => SubmitPromise<TErrors[]> | undefined,
): UseFormResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  function change(event: ChangeEvent) {
    const { name, value } = event.target;

    if (name in data) {
      setData((data) => ({
        ...data,
        [name]: value,
      }));
    }
  }

  function reset() {
    setData(initialData);
  }

  function set(newData: Partial<T>) {
    setData((data) => ({
      ...data,
      ...newData,
    }));
  }

  async function submit() {
    if (isSubmittingRef.current || typeof onSubmit !== "function") {
      return [];
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      return await onSubmit(data);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return { data, change, set, reset, submit, isSubmitting };
}

export default useForm;
