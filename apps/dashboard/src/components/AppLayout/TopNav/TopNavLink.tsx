// Adapted from saleor-dashboard: src/components/AppLayout/TopNav/TopNavLink.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Button, sprinkles } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { Link } from "react-router";

type Variant = "secondary" | "tertiary";

interface TopNavLinkProps {
  to: string;
  /** Icon that represents the destination (not a generic back arrow). */
  icon: ReactNode;
  /** Visible tooltip and accessible name for the destination. */
  title: string;
  variant?: Variant;
}

export const TopNavLink = ({ to, icon, title, variant = "secondary" }: TopNavLinkProps) => (
  <Link to={to} className={sprinkles({ marginRight: 3 })}>
    <Button
      icon={icon}
      variant={variant}
      size="large"
      title={title}
      aria-label={title}
      data-test-id="app-header-back-button"
    />
  </Link>
);
