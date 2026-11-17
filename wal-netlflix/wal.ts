import { type RedisClientType, createClient } from "redis";
import type { QueuePayloadType } from "./types";

const consumer_group = "wal-workers";
const stream_key = "wal:events";
const workers = String(process.pid);
export const WHEN_TO_CLAIM = 10 * 1000;

console.log("workers", workers);

class WalManager {
  private static instance: WalManager;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor() {
    this.publisher = createClient();
    this.subscriber = createClient();
  }

  static getInstance = async (): Promise<WalManager> => {
    if (!WalManager.instance) {
      const instance = new WalManager();
      await instance.init();
      await instance.createConsumerGroup();
      WalManager.instance = instance;
    }
    return WalManager.instance;
  };

  init = async () => {
    try {
      await this.publisher.connect();
      await this.subscriber.connect();
    } catch (e) {
      console.log("error in init", e);
      throw new Error(JSON.stringify(e));
    }
  };

  createConsumerGroup = async () => {
    try {
      await this.subscriber.xGroupCreate(stream_key, consumer_group, "0-0", {
        MKSTREAM: true,
      });
    } catch (e) {
      // console.log("error in createConsumergroup", e);
      console.log("groups already exists");
      // letting the error pass as thats mostly going to be BUSY_GROUP error
    }
  };

  write = async (data: QueuePayloadType) => {
    // throw new Error("just checking broo");

    // this streamID can be usefull
    const streamId = await this.publisher.xAdd(stream_key, "*", {
      type: data.type,
      payload: JSON.stringify(data.payload),
    });

    return streamId;
  };

  readFromConsumerGroup = async () => {
    const response = await this.subscriber.xReadGroup(
      consumer_group,
      workers,
      [
        {
          key: stream_key,
          id: ">",
        },
      ],
      {
        BLOCK: 5 * 1000,
        COUNT: 1,
      },
    );

    return response;
  };

  ackConsumerGroup = async (messageId: string) => {
    const ackResponse = await this.publisher.xAck(
      stream_key,
      consumer_group,
      messageId,
    );

    console.log("ack number", ackResponse);
  };

  claimPendingMessages = async () => {
    const response = await this.subscriber.xAutoClaim(
      stream_key,
      consumer_group,
      workers,
      WHEN_TO_CLAIM,
      "0-0",
      {
        COUNT: 10,
      },
    );

    return response;
  };
}

export const wal = await WalManager.getInstance();
