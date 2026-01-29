import "dotenv/config";
import { spend } from "./awardCore.js";

async function run() {
  await spend("new-user-1769684730549", "1", "should-fail");
}

run().catch((e) => {
  console.error("ERROR:", e?.message);
  process.exit(0);
});











