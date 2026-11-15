import { type RedisClientType, createClient } from "redis";
import type { QueuePayloadType } from "./types";

class WalManager {
  private static instance: WalManager;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor() {
    this.publisher = createClient();
    this.subscriber = createClient();
  }

  init = async () => {
    await this.publisher.connect();
    await this.subscriber.connect();
  };

  static getInstance = async (): Promise<WalManager> => {
    if (!WalManager.instance) {
      const instance = new WalManager();
      await instance.init();
      WalManager.instance = instance;
    }
    return WalManager.instance;
  };

  write = async (data: QueuePayloadType) => {
    await this.publisher.lPush(data.type, JSON.stringify(data.payload));
  };

  consume = async (key: "create_user") => {
    return this.subscriber.brPop(key, 0);
  };
}

export const wal = await WalManager.getInstance();
