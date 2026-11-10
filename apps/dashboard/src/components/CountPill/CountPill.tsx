// Adapted from saleor-dashboard: src/components/CountPill/CountPill.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor imports its MONO_FONT_FAMILY constant; we set the monospace stack in the stylesheet.
import styles from "./CountPill.module.css";

export interface CountPillValue {
  value: number;
  hasMore: boolean;
}

interface CountPillProps {
  count: CountPillValue | undefined;
  active?: boolean;
}

const getCountLabel = (count: CountPillValue | undefined): string | null => {
  if (!count) {
    return null;
  }

  return count.hasMore ? `${count.value}+` : `${count.value}`;
};

export const countPillFromNumber = (value: number): CountPillValue | undefined =>
  value > 0 ? { value, hasMore: false } : undefined;

export const CountPill = ({ count, active = false }: CountPillProps): JSX.Element | null => {
  const label = getCountLabel(count);

  if (!label) {
    return null;
  }

  return <span className={active ? styles.countPillActive : styles.countPill}>{label}</span>;
};
