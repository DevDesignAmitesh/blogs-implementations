// todo: understand where to add retries with dlq and implement it.

import { wal, WHEN_TO_CLAIM } from "./wal";

async function main() {
  for (;;) {
    try {
      const res = await wal.claimPendingMessages();

      if (!res.messages.length) {
      } else {
        console.log(JSON.stringify(res, null, 2));
        for (const msg of res.messages) {
          // some processing then ack

          await wal.ackConsumerGroup(msg?.id!);
        }
      }
    } catch (e) {
      // retry if something fails???
    }
  }
}

setInterval(main, WHEN_TO_CLAIM);
