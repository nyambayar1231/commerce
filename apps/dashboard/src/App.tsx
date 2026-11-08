import { Box, Text } from "@saleor/macaw-ui";

export function App() {
  return (
    <Box padding={6} display="flex" flexDirection="column" gap={2}>
      <Text size={5} fontWeight="bold">
        Hello
      </Text>
      <Box
        padding={4}
        borderRadius={4}
        borderStyle="solid"
        borderWidth={1}
        borderColor="default1"
        backgroundColor="default2"
      >
        <Text size={3}>Styled with Macaw tokens</Text>
      </Box>
    </Box>
  );
}
