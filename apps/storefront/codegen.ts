// Client preset with `documentMode: "string"`: each document becomes a typed string (ARCHITECTURE
// §10.6). The generated `src/gql/` is committed and checked for drift in CI.
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["src/graphql/**/*.graphql"],
  generates: {
    "src/gql/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: {
        documentMode: "string",
        enumsAsTypes: true,
        useTypeImports: true,
        strictScalars: true,
        scalars: {
          DateTime: "string",
          Decimal: "number",
          JSON: "unknown",
          JSONString: "string",
          UUID: "string",
          Upload: "never",
        },
      },
    },
  },
};

export default config;
