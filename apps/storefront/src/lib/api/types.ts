export type ApiErrorKind = "network" | "timeout" | "http" | "graphql";

/** A failed API call: transport, HTTP status, or any GraphQL `errors` entry. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly operation: string;
  readonly requestId: string;
  readonly status?: number;
  /** `errors[].extensions.code` of the response, for mapping to messages. */
  readonly codes: string[];

  constructor(init: {
    kind: ApiErrorKind;
    operation: string;
    requestId: string;
    status?: number;
    codes?: string[];
    message?: string;
  }) {
    super(init.message ?? `API ${init.kind} error in ${init.operation}`);
    this.name = "ApiError";
    this.kind = init.kind;
    this.operation = init.operation;
    this.requestId = init.requestId;
    this.status = init.status;
    this.codes = init.codes ?? [];
  }
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
