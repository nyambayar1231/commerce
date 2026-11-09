// Adapted from saleor-dashboard: src/components/Datagrid/hooks/useRowAnchorHandler.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { MouseEvent } from "react";
import { type NavigateOptions, useNavigate } from "react-router";

export const useRowAnchorHandler = (navigatorOpts?: NavigateOptions) => {
  const navigate = useNavigate();

  return (e: MouseEvent<HTMLAnchorElement>) => {
    // Native new-tab gestures must reach the <a>: cmd/ctrl+click, and middle
    // click in browsers that still fire click with button === 1 (not only auxclick).
    if (e.metaKey || e.ctrlKey || (e.button !== undefined && e.button !== 0)) {
      return;
    }

    // Prevent default when navigate with browser router
    e.preventDefault();

    if (e.currentTarget.dataset.reactRouterPath) {
      // Navigate gets only a path to navigate, for example, /products/1
      // Navigate use browser router and cover case when url is with /dashboard or not
      navigate(e.currentTarget.dataset.reactRouterPath, navigatorOpts);
    }
  };
};
