// todo: understand and implement it.

import { wal } from "./wal";

async function main() {
  try {
    const res = await wal.consume("create_user");

    console.log("received data", res);

    // some db operations;
  } catch (e) {
    // retry if something fails???
  }
}

setInterval(main, 5 * 1000);
