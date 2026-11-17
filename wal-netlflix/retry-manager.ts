import { createClient, type RedisClientType } from "redis";
import type { Retry, RetryTypeEnum } from "./types";
import { wal } from "./wal";

class RetryManager {
  private static instance: RetryManager;
  private client: RedisClientType;

  constructor() {
    this.client = createClient();
  }

  static getInstance = async (): Promise<RetryManager> => {
    if (!RetryManager.instance) {
      const instance = new RetryManager();
      await instance.init();
      RetryManager.instance = instance;
    }
    return RetryManager.instance;
  };

  init = async () => {
    await this.client.connect();
  };

  private retry = async ({
    action,
    maxRetry = 3,
    DELTA = 1,
  }: {
    action: () => void;
    maxRetry: number;
    DELTA: number;
  }) => {
    const response = await new Promise<boolean>((res, rej) => {
      console.log("RETRYING WITH PAYLOAD", { maxRetry, DELTA, action });

      const delay = DELTA * 1000;

      if (maxRetry <= 0) {
        console.log("IS ZERO");
        res(false);
      } else {
        setTimeout(async () => {
          try {
            console.log("RUNNING TIMEOUT - 1");
            await action();
            res(true);
          } catch {
            console.log("RUNNING TIMEOUT - 2");
            const catchResponse = await this.retry({
              action,
              maxRetry: maxRetry - 1,
              DELTA: DELTA * 2,
            });

            res(catchResponse);
          }
        }, delay);
      }
    });

    console.log("PROMISE RESPONSE", response);

    return response;
  };

  handleRetry = async ({
    action,
    maxRetry,
    payload,
  }: {
    action: () => void;
    maxRetry: number;
    payload: unknown;
  }) => {
    console.log("STARTED RETRY PROCESS");

    const retryId = crypto.randomUUID();

    try {
      // save the retry payload
      const writeResponse = await this.write({
        id: retryId,
        payload,
        maxRetry,
        type: "retry:create_user",
      });

      if (!writeResponse) {
        return false;
      }

      // retry THIS one
      const response = await this.retry({
        action,
        maxRetry,
        DELTA: 1,
      });

      console.log("HANDLE RETRY, RETRY RESPONSE", response);

      // delete & update it
      const retires = await this.get("retry:create_user");

      console.log("RETIREs", retires);

      const filteredRetry = JSON.stringify(
        retires.find((rt) => rt.id === retryId),
      );

      await this.delete("retry:create_user", filteredRetry);

      if (!response) {
        // push into a DLQ (as this will be false after all the maxretry)
        await wal.write({ payload, type: "dlq" });
        return false;
      }

      return true;
    } catch (e) {
      // save if error occurred
      await this.write({
        id: retryId,
        payload,
        maxRetry,
        type: "retry:create_user",
      });

      return false;
    }
  };

  write = async (data: Retry) => {
    console.log("DATA IN sADD", data);

    try {
      const key = data.type;
      await this.client.sAdd(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.log("error in write", e);
      return false;
    }
  };

  get = async (key: RetryTypeEnum) => {
    try {
      const members = (await this.client.sMembers(key)).map((mm) =>
        JSON.parse(mm),
      ) as Retry[];

      return members;
    } catch (e) {
      console.log("error in get", e);
      return [];
    }
  };

  delete = async (key: RetryTypeEnum, retry: string) => {
    try {
      await this.client.sRem(key, retry);
      return true;
    } catch (e) {
      console.log("error in update", e);
      return false;
    }
  };
}

export const retryManager = await RetryManager.getInstance();
