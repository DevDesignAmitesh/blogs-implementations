import express from "express";
import { wal } from "./wal";
import { handleRetry } from "./handleRetry";

const app = express();
const PORT = 4000;

app.use(express.json());

app.post("/write", async (req, res) => {
  const { name } = req.body;
  const userId = crypto.randomUUID();

  try {
    await wal.write({
      type: "create_user",
      payload: { name, id: userId },
    });

    res.json({ message: "request accepted" });
  } catch (e) {
    // handle retry
    const retryId = crypto.randomUUID();

    const response = await handleRetry({
      id: retryId,
      type: "create_user",
      payload: { name, id: userId },
      maxRetry: 5,
      action: wal.write,
    });
  }
});

app.listen(PORT, () => console.log("code is running at", PORT));
