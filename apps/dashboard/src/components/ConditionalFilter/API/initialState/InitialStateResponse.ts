// What the URL value provider needs from a list's initial filter state (Saleor keeps one class per
// list: InitialProductStateResponse, InitialOrderStateResponse…). The provider loads the labels
// behind the URL's values once, then rebuilds the rows with them.
import type { ItemOption } from "../../FilterElement/ConditionValue";
import type { UrlToken } from "../../ValueProvider/UrlToken";
import type { FetchingParams } from "./product/useProductInitialAPIState";

export interface InitialStateResponse {
  /** The loaded options a URL token names; empty when this list has none for the token's field. */
  filterByUrlToken: (token: UrlToken) => ItemOption[];
}

export interface InitialAPIState {
  data: InitialStateResponse;
  loading: boolean;
  fetchQueries: (params: FetchingParams) => Promise<void>;
}
