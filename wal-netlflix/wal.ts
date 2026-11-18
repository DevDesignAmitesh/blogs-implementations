import { type RedisClientType, createClient } from "redis";
import type { QueuePayloadType, RetryJob } from "./types";

const consumer_group = "wal-workers";
const stream_key = "wal:events";
const sets_retry_key = "wal:retries";
const workers = String(process.pid);
export const WHEN_TO_CLAIM = 10 * 1000;

console.log("workers", workers);

class WalManager {
  private static instance: WalManager;
  private client: RedisClientType;

  constructor() {
    this.client = createClient();
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
      await this.client.connect();
    } catch (e) {
      console.log("error in init", e);
      throw new Error(JSON.stringify(e));
    }
  };

  createConsumerGroup = async () => {
    try {
      await this.client.xGroupCreate(stream_key, consumer_group, "0-0", {
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
    const streamId = await this.client.xAdd(stream_key, "*", {
      type: data.type,
      payload: JSON.stringify(data.payload),
    });

    return streamId;
  };

  readFromConsumerGroup = async () => {
    const response = await this.client.xReadGroup(
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
    const ackResponse = await this.client.xAck(
      stream_key,
      consumer_group,
      messageId,
    );

    console.log("ack number", ackResponse);
  };

  claimPendingMessages = async () => {
    const response = await this.client.xAutoClaim(
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

  scheduleRetry = async (retries: RetryJob[]) => {
    const dataToInsert = retries.map((retry) => ({
      value: JSON.stringify(retry),
      score: retry.nextRetryAt,
    }));

    const added = await this.client.zAdd(sets_retry_key, dataToInsert);

    return added;
  };

  getDueRetries = async () => {
    // what about min??
    const retries = (
      await this.client.zRangeByScore(sets_retry_key, "-inf", Date.now())
    ).map((retry) => JSON.parse(retry)) as RetryJob[];

    // we have to parse it (mostly)

    return retries;
  };

  removeRetry = async (members: string[]) => {
    const deleted = await this.client.zRem(sets_retry_key, members);

    return deleted;
  };

  claimDueRetry = async () => {
    const script = `
      local job = redis.call(
        "ZRANGE",
        KEYS[1],
        0,
        0,
        "WITHSCORES"
      )

      if #job == 0 then
        return nil
      end

      local currentTime = tonumber(ARGV[1])
      local score = tonumber(job[2])

      if score <= currentTime then
        redis.call("ZREM", KEYS[1], job[1])
        return job[1]
      end

      return nil
    `;

    const result = await this.client.eval(script, {
      keys: [sets_retry_key],
      arguments: [String(Date.now())],
    });

    return result ? (JSON.parse(result as string) as RetryJob) : null;
  };
}

export const wal = await WalManager.getInstance();
