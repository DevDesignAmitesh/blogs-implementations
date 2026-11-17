// todo: understand where to add retries with dlq and implement it.

import { wal } from "./wal";

async function main() {
  for (;;) {
    try {
      const res = await wal.readFromConsumerGroup();

      if (!res) {
        // nothingg
      } else {
        console.log("received name", res[0]?.name);
        console.log(
          "received messages",
          JSON.stringify(res[0]?.messages, null, 2),
        );
        console.log("received ID", res[0]?.messages[0].id);

        // some db operations;

        await wal.ackConsumerGroup(res[0]?.messages[0].id);
      }
    } catch (e) {
      // retry if something fails???
    }
  }
}

main();
