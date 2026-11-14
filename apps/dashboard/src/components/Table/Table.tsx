// Adapted from saleor-dashboard: src/components/Table/Table.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's native <table> primitives (a subset of the MUI table API): table, body, row and body
// cell. Head and footer sections come with their first user.
import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
} from "react";

import styles from "./Table.module.css";

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  ({ className, children, ...rest }, ref) => (
    <table ref={ref} className={classes(styles.table, className)} {...rest}>
      {children}
    </table>
  ),
);

Table.displayName = "Table";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ children, ...rest }, ref) => (
  <tbody ref={ref} {...rest}>
    {children}
  </tbody>
));

TableBody.displayName = "TableBody";

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Highlights the row on pointer hover. */
  hover?: boolean;
  selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, children, hover, selected, ...rest }, ref) => (
    <tr
      ref={ref}
      className={classes(
        styles.row,
        hover && styles.rowHover,
        selected && styles.rowSelected,
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  ),
);

TableRow.displayName = "TableRow";

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
  padding?: "checkbox" | "none" | "normal";
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ align, className, children, padding = "normal", ...rest }, ref) => (
    <td
      ref={ref}
      className={classes(
        styles.cell,
        padding === "checkbox" && styles.cellPaddingCheckbox,
        padding === "none" && styles.cellPaddingNone,
        align === "right" && styles.alignRight,
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  ),
);

TableCell.displayName = "TableCell";
