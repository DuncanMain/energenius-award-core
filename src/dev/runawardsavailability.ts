import "dotenv/config";
import { getAvailableAwardsForUser } from "../awardsAvailability.js";

async function run() {
  const out = await getAvailableAwardsForUser("user123");
  console.log(JSON.stringify(out, null, 2));
}

run().catch((e) => {
  console.error("ERROR:", e?.message);
  process.exit(1);
});


