import "dotenv/config";
import { awardEvent } from "../awardCore.js";

async function run() {
  const res = await awardEvent(
    "user123",
    "test_event",
    {
      timestamp: new Date().toISOString(),
      source: "dev-script",
    }
  );

  console.log("txHash:", res.txHash);
  console.log("address:", res.address);
  console.log("newBalanceWei:", res.newBalanceWei.toString());
}

run().catch((e) => {
  console.error("ERROR:", e?.message);
  process.exit(1);
});
