// Adapted from saleor-dashboard: src/categories/views/CategoryDetails.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Placeholder until the detail page (M2.1.4): Saleor's TopNav with the category's name, the
// loading state, and NotFound for an unknown id.
import { useQuery } from "@apollo/client";
import { Box, Skeleton } from "@saleor/macaw-ui";
import { useParams } from "react-router";

import { TopNav } from "../../components/AppLayout/TopNav";
import { CategoryDetailsDocument } from "../../graphql/types.generated";
import { NotFound } from "../../NotFound";

export const CategoryDetails = () => {
  const { id = "" } = useParams();
  const { data, loading } = useQuery(CategoryDetailsDocument, { variables: { id } });
  const category = data?.category;

  if (!loading && !category) {
    return <NotFound />;
  }

  return (
    <TopNav
      title={
        category?.name ?? (
          <Box __width="200px">
            <Skeleton />
          </Box>
        )
      }
    />
  );
};
