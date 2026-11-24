// Adapted from saleor-dashboard: src/structures/components/MenuItemDialog/options.ts,
// MenuItemDialogLinkValue/useLinkValue.ts and src/structures/views/MenuDetails/utils.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Pure helpers of the item dialog: which select options the three searches produce (plus the typed
// URL), the link an existing item shows, and the mutation input the form maps to. Saleor keeps the
// link kind in its own field and searches one kind at a time; the brief merges them into one select.
import type { Option } from "@saleor/macaw-ui";

import type {
  MenuItemCreateInput,
  MenuItemFragment,
  MenuItemInput,
} from "../../../graphql/types.generated";
import type { MenuItemDialogFormData, MenuItemLink, MenuItemType } from "./types";

export interface LinkSearchResults {
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  pages: { id: string; title: string }[];
}

/** What each kind of link calls itself in the select's labels. */
export interface LinkTypeLabels {
  category: string;
  collection: string;
  page: string;
  /** The prefix of the typed-URL option, e.g. "Link to". */
  url: string;
}

export interface LinkOption extends Option {
  linkType: MenuItemType;
  /** The value the mutation takes: a global id, or the URL itself. */
  linkValue: string;
}

const toOption = (link: MenuItemLink, labels: LinkTypeLabels): LinkOption => ({
  value: `${link.type}:${link.value}`,
  label: `${labels[link.type]}: ${link.display}`,
  linkType: link.type,
  linkValue: link.value,
});

/**
 * The API's URL rule (Saleor's URLField): an absolute http(s) URL or a path the storefront links
 * to. A typed search only becomes the "Link to" option when it passes that rule.
 */
export const isUrlLike = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith("/");

/**
 * The select's options: the typed URL first when the input looks like one, then Saleor's groups of
 * categories, collections and pages in the order its dialog offers them.
 */
export const getLinkOptions = (
  results: LinkSearchResults | undefined,
  typedValue: string,
  labels: LinkTypeLabels,
): LinkOption[] => {
  const options: LinkOption[] = [];
  const typedUrl = typedValue.trim();

  if (isUrlLike(typedUrl)) {
    options.push(toOption({ type: "url", value: typedUrl, display: typedUrl }, labels));
  }

  for (const category of results?.categories ?? []) {
    options.push(
      toOption({ type: "category", value: category.id, display: category.name }, labels),
    );
  }
  for (const collection of results?.collections ?? []) {
    options.push(
      toOption({ type: "collection", value: collection.id, display: collection.name }, labels),
    );
  }
  for (const page of results?.pages ?? []) {
    options.push(toOption({ type: "page", value: page.id, display: page.title }, labels));
  }

  return options;
};

/** The link an existing item points at, or null when it has none. */
export const getItemLink = (
  item: Pick<MenuItemFragment, "category" | "collection" | "page" | "url"> | undefined | null,
): MenuItemLink | null => {
  if (!item) {
    return null;
  }

  if (item.category) {
    return { type: "category", value: item.category.id, display: item.category.name };
  }
  if (item.collection) {
    return { type: "collection", value: item.collection.id, display: item.collection.name };
  }
  if (item.page) {
    return { type: "page", value: item.page.id, display: item.page.title };
  }
  if (item.url) {
    return { type: "url", value: item.url, display: item.url };
  }

  return null;
};

export const getItemLinkOption = (
  item: Pick<MenuItemFragment, "category" | "collection" | "page" | "url"> | undefined | null,
  labels: LinkTypeLabels,
): LinkOption | null => {
  const link = getItemLink(item);

  return link ? toOption(link, labels) : null;
};

export const getLinkOption = (link: MenuItemLink, labels: LinkTypeLabels): LinkOption =>
  toOption(link, labels);

/** The link's mutation field only: never the name, which the spread must not override. */
type LinkInput = Pick<MenuItemInput, "url" | "category" | "collection" | "page">;

const linkToInput = (link: MenuItemLink): LinkInput => {
  switch (link.type) {
    case "category":
      return { category: link.value };
    case "collection":
      return { collection: link.value };
    case "page":
      return { page: link.value };
    case "url":
      return { url: link.value };
  }
};

/** The dialog's data → `menuItemUpdate` input: the name plus the one link field. */
export const getMenuItemInputData = (data: MenuItemDialogFormData): MenuItemInput => ({
  name: data.name,
  ...(data.link ? linkToInput(data.link) : {}),
});

/** The dialog's data → `menuItemCreate` input, which also names the menu. */
export const getMenuItemCreateInputData = (
  menu: string,
  data: MenuItemDialogFormData,
): MenuItemCreateInput => ({
  menu,
  name: data.name,
  ...(data.link ? linkToInput(data.link) : {}),
});
