import express from "express";
import { wal } from "./wal";
import { retryManager } from "./retry-manager";
import type { QueuePayloadType } from "./types";

const app = express();
const PORT = 4000;

app.use(express.json());

app.post("/write", async (req, res) => {
  const { name } = req.body;
  const userId = crypto.randomUUID();

  const payload: QueuePayloadType = {
    type: "create_user",
    payload: { name, id: userId },
  };

  try {
    await wal.write(payload);

    res.status(201).json({ message: "request accepted" });
  } catch (e) {
    // handle retry
    const response = await retryManager.handleRetry({
      action: () => wal.write(payload),
      maxRetry: 4,
    });

    console.log("RECEIVED RESPONSE", response);

    // return the response statement
    if (!response) {
      res.status(503).json({
        message: "something went wrong, try again after few minutes",
      });
      return;
    }

    res.status(201).json({ message: "request accepted" });
  }
});

app.listen(PORT, () => console.log("code is running at", PORT));
