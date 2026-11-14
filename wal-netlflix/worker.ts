import { wal } from "./wal";

const res = await wal.consume("create_user");

console.log("received data", res);
