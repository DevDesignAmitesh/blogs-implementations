import { wal } from "./wal";

async function main() {
  const res = await wal.consume("create_user");

  console.log("received data", res);
}

setInterval(main, 5 * 1000);
