import "dotenv/config";
import { spend } from "../awardCore.js";

async function run() {
  const res = await spend("user123", "1", "dev-script spend");

  console.log("txHash:", res.txHash);
  console.log("address:", res.address);
  console.log("newBalanceWei:", res.newBalanceWei.toString());
}

run().catch((e) => {
  console.error("ERROR:", e?.message);
  process.exit(1);
});

