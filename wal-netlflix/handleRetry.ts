type RetryPayload = {
  id: string;
  type: "create_user";
  payload: unknown;
  maxRetry: number;
  // todo: create a reusable types of below
  action: (inputs: { type: "create_user"; payload: unknown }) => Promise<void>;
};

export const handleRetry = async ({
  action,
  id,
  maxRetry,
  payload,
  type,
}: RetryPayload) => {
  let delay = 1 * 1000;
  let timeout: NodeJS.Timeout;

  new Promise((res, rej) => {});
};
