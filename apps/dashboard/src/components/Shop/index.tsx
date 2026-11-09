// Adapted from saleor-dashboard: src/components/Shop/index.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor skips the query until the user is authenticated and starts analytics with the result;
// we have neither yet (login is M1).
import { useQuery } from "@apollo/client";
import { createContext, type ReactNode, useContext } from "react";

import { ShopInfoDocument, type ShopInfoQuery } from "../../graphql/types.generated";

type ShopContext = ShopInfoQuery["shop"] | undefined;

export const ShopContext = createContext<ShopContext>(undefined);

export const ShopProvider = ({ children }: { children: ReactNode }) => {
  const { data } = useQuery(ShopInfoDocument);

  return (
    <ShopContext.Provider value={data ? data.shop : undefined}>{children}</ShopContext.Provider>
  );
};

/** Saleor's src/hooks/useShop.ts: the shop, or undefined while it loads (or if it failed). */
export const useShop = (): ShopContext => useContext(ShopContext);
