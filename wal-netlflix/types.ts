export type QueueEnumType = "create_user" | "dlq";

export type QueuePayloadType = {
  type: QueueEnumType;
  payload: unknown;
};

export type RetryTypeEnum = "retry:create_user";

export type Retry = {
  id: string;
  type: RetryTypeEnum;
  payload: unknown;
  maxRetry: number;
};

export type RetryJob = {
  id: string;
  payload: unknown;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number;
};
