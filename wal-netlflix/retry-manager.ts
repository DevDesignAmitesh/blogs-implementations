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

  private retry = async () => {};

  handleRetry = async ({
    action,
    maxRetry,
  }: {
    action: () => void;
    maxRetry: number;
  }) => {
    const retryId = crypto.randomUUID();

    try {
      // save the retry payload
      await this.write({
        id: retryId,
        action,
        maxRetry,
        totalRetry: 0,
        type: "retry:create_user",
      });

      // retry THIS one
      this.retry;

      // delete & update it
      const retires = await this.get("retry:create_user");

      const filteredRetries = retires
        .filter((rt) => rt.id !== retryId)
        .map((rt) => JSON.stringify(rt));

      await this.update("retry:create_user", filteredRetries);
    } catch (e) {
      // save if error occurred
      await this.write({
        id: retryId,
        action,
        maxRetry,
        totalRetry: 0,
        type: "retry:create_user",
      });
    }
  };

  write = async (data: Retry) => {
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
