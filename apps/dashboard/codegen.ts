// Saleor's codegen-main.ts generates React hooks (typescript-react-apollo); ADR-0007 chose typed
// documents instead: `useQuery(ShopInfoDocument)` is typed from the generated document. The
// type settings mirror Saleor's.
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["./src/**/queries.ts", "./src/**/mutations.ts", "./src/**/fragments/*.ts"],
  generates: {
    "./src/graphql/types.generated.ts": {
      plugins: ["typescript", "typescript-operations", "typed-document-node"],
      config: {
        nonOptionalTypename: true,
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
          defaultValue: false,
        },
        onlyOperationTypes: true,
        // Our tsconfig sets verbatimModuleSyntax: type imports must say so.
        useTypeImports: true,
      },
    },
  },
};

export default config;
