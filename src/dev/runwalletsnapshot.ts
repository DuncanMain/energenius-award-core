import "dotenv/config";
import { getWalletSnapshot } from "../walletSnapshot.js";

async function run() {
  const snap = await getWalletSnapshot("user123");
  console.log(JSON.stringify(snap, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
