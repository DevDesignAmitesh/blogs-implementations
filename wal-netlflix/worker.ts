// todo: understand where to add retries with dlq and implement it.

import { wal } from "./wal";

async function main() {
  for (;;) {
    try {
      const res = await wal.consume("create_user");

      if (!res) {
        // nothingg
      } else {
        console.log("received data", res);

        // some db operations;
      }
    } catch (e) {
      // retry if something fails???
    }
  }
}

main();
