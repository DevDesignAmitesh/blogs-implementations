export type QueueEnumType = "create_user";

export type QueuePayloadType = {
  type: QueueEnumType;
  payload: unknown;
};

export type RetryTypeEnum = "retry:create_user";

export type Retry = {
  id: string;
  type: RetryTypeEnum;
  action: () => void;
  maxRetry: number;
  totalRetry: number;
};
