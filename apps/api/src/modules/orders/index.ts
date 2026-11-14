// Public surface of the `orders` module (ARCHITECTURE.md §2).

export {
  enqueueOrderConfirmation,
  orderConfirmationHandler,
  orderConfirmationQueue,
  renderOrderConfirmation,
} from "./confirmationEmail.ts";
export type { DraftLineInput, DraftLineResult, DraftLinesResult } from "./draftLines.ts";
export {
  addDraftOrderLines,
  deleteDraftOrderLine,
  MAX_DRAFT_LINE_QUANTITY,
  refreshDraftLines,
  updateDraftOrderLine,
} from "./draftLines.ts";
export type {
  DraftCustomer,
  DraftOrderInput,
  DraftOrderResult,
  DraftShippingMethod,
} from "./drafts.ts";
export {
  createDraftOrder,
  deleteDraftOrder,
  lockDraftOrder,
  saveDraftTotals,
  updateDraftOrder,
} from "./drafts.ts";
export type {
  FulfillLineInput,
  FulfillmentLineRow,
  FulfillmentRow,
  FulfillOrderResult,
  OrderActionResult,
  OrderError,
  OrderErrorCode,
  RefundError,
  RefundErrorCode,
  RefundResult,
} from "./lifecycle.ts";
export {
  cancelOrder,
  fulfillOrder,
  getFulfillmentLinesByFulfillmentIds,
  getFulfillmentLinesByIds,
  getFulfillmentsByOrderIds,
  getOrderLinesByIds,
  lockOrder,
  markOrderAsPaid,
  refundOrderTransaction,
  uncoveredAmount,
} from "./lifecycle.ts";
export type { OrderLoaders } from "./loaders.ts";
export { createOrderLoaders } from "./loaders.ts";
export type {
  OrderListArgs,
  OrderPage,
  OrderSortField,
  OrderStatus,
  OrderWhere,
} from "./orderList.ts";
export { InvalidOrderCursorError, listOrders } from "./orderList.ts";
export type {
  OrderEventRow,
  OrderLineRow,
  OrderLineSnapshot,
  OrderRow,
  OrderSnapshot,
} from "./orders.ts";
export {
  createOrderFromCheckout,
  getOrder,
  getOrderEventsByOrderIds,
  getOrderLinesByOrderIds,
  matchOrdersWithNewUser,
} from "./orders.ts";
export type {
  OrderAuthorizeStatus,
  OrderChargeStatus,
  OrderPaymentSummary,
} from "./payments.ts";
export { orderPaymentSummary } from "./payments.ts";
