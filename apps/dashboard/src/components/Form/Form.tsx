// Adapted from saleor-dashboard: src/components/Form/Form.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor marks Form as deprecated in favour of react-hook-form but still uses it for
// CreateCategoryDialog; we follow the dialog. `confirmLeave`, `formId` and the save-disabled check
// come with the reduced useForm's next features (M2.1.4).
import type * as React from "react";

import useForm, { type SubmitPromise, type UseFormResult } from "../../hooks/useForm";

interface FormProps<TData, TErrors>
  extends Omit<React.HTMLProps<HTMLFormElement>, "onSubmit" | "children"> {
  children: (props: UseFormResult<TData>) => React.ReactNode;
  initial: TData;
  resetOnSubmit?: boolean;
  onSubmit?: (data: TData) => SubmitPromise<TErrors[]> | undefined;
}

function Form<TData extends object, TErrors>({
  children,
  initial,
  resetOnSubmit,
  onSubmit,
  ...rest
}: FormProps<TData, TErrors>) {
  const renderProps = useForm(initial, onSubmit);

  function handleSubmit(event?: React.FormEvent<HTMLFormElement>, cb?: () => void) {
    const { reset, submit } = renderProps;

    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (cb) {
      cb();
    }

    if (resetOnSubmit) {
      reset();
    }

    void submit();
  }

  return (
    <form {...rest} onSubmit={handleSubmit}>
      {children(renderProps)}
    </form>
  );
}

Form.displayName = "Form";

export default Form;
