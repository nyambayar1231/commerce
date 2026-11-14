// Adapted from saleor-dashboard: src/components/Checkbox/Checkbox.tsx (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce), with the icons of macaw-ui 0.7.4: src/icons/CheckboxIcon.tsx and
// CheckboxCheckedIcon.tsx (CC-BY-4.0, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The checkbox Saleor's tables use (MUI's, styled by legacy macaw-ui, which we don't ship): a native
// input over Saleor's 20px square icons in a 48px click area. Helper text and indeterminate state
// come with their first user.
import type { InputHTMLAttributes } from "react";

import styles from "./Checkbox.module.css";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  className?: string;
};

export const Checkbox = ({ checked, disabled, className, ...rest }: CheckboxProps) => (
  <span
    className={[styles.root, checked && styles.checked, disabled && styles.disabled, className]
      .filter(Boolean)
      .join(" ")}
    data-test-id="checkbox"
  >
    <input
      type="checkbox"
      className={styles.input}
      checked={checked}
      disabled={disabled}
      {...rest}
    />
    {checked ? (
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="23" height="23" rx="1.5" fill="currentColor" />
        <path
          className={styles.tick}
          fillRule="evenodd"
          clipRule="evenodd"
          d="M17.5711 4.7629C17.9653 4.34801 18.6267 4.34801 19.0209 4.7629L20.3455 6.1568C20.7122 6.54279 20.7122 7.14848 20.3455 7.53447L9.45066 19L3.65454 12.9002C3.28777 12.5143 3.28777 11.9086 3.65454 11.5226L4.97906 10.1287C5.3733 9.71378 6.03466 9.71378 6.4289 10.1287L9.45066 13.3087L17.5711 4.7629Z"
        />
      </svg>
    ) : (
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          width="22"
          height="22"
          rx="2"
          ry="2"
          x="1"
          y="1"
          strokeWidth="2"
          stroke="currentColor"
          fill="transparent"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </span>
);
