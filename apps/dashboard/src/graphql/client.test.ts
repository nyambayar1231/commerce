import { gql } from "@apollo/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getApiUrl } from "../config";
import { apolloClient } from "./client";

const uploadMediaMutation = gql`
  mutation UploadMedia($file: Upload!) {
    productMediaCreate(input: { image: $file }) {
      media {
        id
      }
    }
  }
`;

const deleteMediaMutation = gql`
  mutation DeleteMedia($id: ID!) {
    productMediaDelete(id: $id) {
      media {
        id
      }
    }
  }
`;

const stubFetch = (data: unknown) => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const firstCall = (fetchMock: ReturnType<typeof stubFetch>) => {
  const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

  expect(call).toBeDefined();

  return call;
};

beforeEach(async () => {
  await apolloClient.clearStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apollo client uploads", () => {
  it("sends a mutation with a File variable as a multipart request", async () => {
    const fetchMock = stubFetch({
      productMediaCreate: {
        __typename: "ProductMediaCreate",
        media: { __typename: "ProductMedia", id: "media-1" },
      },
    });
    const file = new File(["image-bytes"], "shoe.png", { type: "image/png" });

    await apolloClient.mutate({ mutation: uploadMediaMutation, variables: { file } });

    const [uri, init] = firstCall(fetchMock);
    const body = init.body as FormData;
    const headers = new Headers(init.headers);

    expect(uri).toBe(getApiUrl());
    expect(init.credentials).toBe("include");
    expect(body).toBeInstanceOf(FormData);
    expect(JSON.parse(String(body.get("operations")))).toMatchObject({
      variables: { file: null },
    });
    expect(JSON.parse(String(body.get("map")))).toEqual({ "1": ["variables.file"] });
    const uploaded = body.get("1") as File;

    expect(uploaded.name).toBe("shoe.png");
    expect(uploaded.type).toBe("image/png");
    expect(uploaded.size).toBe(file.size);
    expect(headers.get("x-graphql-yoga-csrf")).toBe("1");
    // fetch must add the multipart boundary itself.
    expect(headers.get("content-type")).toBeNull();
  });

  it("sends a mutation without files as a JSON POST", async () => {
    const fetchMock = stubFetch({
      productMediaDelete: {
        __typename: "ProductMediaDelete",
        media: { __typename: "ProductMedia", id: "media-1" },
      },
    });

    await apolloClient.mutate({ mutation: deleteMediaMutation, variables: { id: "media-1" } });

    const [, init] = firstCall(fetchMock);
    const headers = new Headers(init.headers);

    expect(typeof init.body).toBe("string");
    expect(headers.get("content-type")).toContain("application/json");
    expect(headers.get("x-graphql-yoga-csrf")).toBe("1");
  });
});
