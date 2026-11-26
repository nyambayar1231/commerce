// Public surface of the `payments` module (ARCHITECTURE.md §2).

export { DUMMY_GATEWAY_ID, dummyGateway, MANUAL_GATEWAY_ID } from "./gateways/builtIn.ts";
export type { FakeGateway } from "./gateways/fake.ts";
export { createFakeGateway, FAKE_GATEWAY_ID } from "./gateways/fake.ts";
export type { GatewayRegistry } from "./gateways/registry.ts";
export {
  createGatewayRegistry,
  gatewayRegistryFromEnv,
  readPaymentGatewayNames,
} from "./gateways/registry.ts";
export type { PaymentGateway } from "./gateways/types.ts";
export { GatewayUnavailableError } from "./gateways/types.ts";
export { paidCheckoutQueue, RECONCILE_CRON, reconcilePaymentsQueue } from "./jobs.ts";
export type { PaymentLoaders } from "./loaders.ts";
export { createPaymentLoaders } from "./loaders.ts";
export type { ReconcileReport } from "./reconcile.ts";
export { createReconcileHandler, reconcilePayments } from "./reconcile.ts";
export type {
  ApplyStatusResult,
  ChargeRequestInput,
  PaymentEventRow,
  PaymentEventType,
  PaymentTransactionRow,
  TransactionAction,
  TransactionInitializeError,
  TransactionInitializeErrorCode,
  TransactionInitializeResult,
} from "./transactions.ts";
export {
  applyGatewayStatus,
  cancelOpenAttempts,
  coveredAmounts,
  createManualOrderTransaction,
  getEventsByTransactionIds,
  getOpenCheckoutAttempts,
  getTransaction,
  getTransactionsByCheckoutIds,
  getTransactionsByOrderIds,
  initializeReplay,
  lockCheckoutTransactions,
  lockOrderTransactions,
  MANUAL_PROVIDER,
  moveCheckoutTransactionsToOrder,
  netCharged,
  orderNetChargedSql,
  processInitializeRequest,
  processRefundRequest,
  recordInitializeRequest,
  recordRefundRequest,
  refundableAmount,
  transactionActions,
} from "./transactions.ts";
