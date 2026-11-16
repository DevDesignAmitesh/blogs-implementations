// todo: when we are starting the server, take all the pending todos from the "consume" function and run themm

import { createClient, type RedisClientType } from "redis";
import type { Retry, RetryTypeEnum } from "./types";

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
  }: {
    action: () => void;
    maxRetry: number;
  }) => {
    console.log("STARTED RETRY PROCESS");

    const retryId = crypto.randomUUID();

    try {
      // save the retry payload
      const writeResponse = await this.write({
        id: retryId,
        action,
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

      console.log("HANDLE RETYR, RETRY RESPONSE", response);

      if (!response) {
        return false;
      }

      // delete & update it
      const retires = await this.get("retry:create_user");

      console.log("RETIREs", retires);

      const filteredRetries = retires
        .filter((rt) => rt.id !== retryId)
        .map((rt) => JSON.stringify(rt));

      await this.update("retry:create_user", filteredRetries);

      return true;
    } catch (e) {
      // save if error occurred
      await this.write({
        id: retryId,
        action,
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

  update = async (key: RetryTypeEnum, retires: string[]) => {
    try {
      await this.client.sAdd(key, retires);
      return true;
    } catch (e) {
      console.log("error in update", e);
      return false;
    }
  };
}

export const retryManager = await RetryManager.getInstance();
