import fs from "node:fs";
import path from "node:path";

export type AwardRule = {
  id: string;
  title: string;
  encAmount: string; // whole tokens as string, e.g. "10"
  maxCount: number;  // 0 = unlimited
};

const awardTablePath = path.resolve(process.cwd(), "award-table.json");

function loadAwardTable(): AwardRule[] {
  const raw = fs.readFileSync(awardTablePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("award-table.json must be a JSON array");
  }

  // minimal validation
  for (const r of parsed) {
    if (!r || typeof r !== "object") throw new Error("Invalid rule object");
    if (typeof r.id !== "string" || r.id.trim() === "") throw new Error("Rule.id required");
    if (typeof r.title !== "string") throw new Error(`Rule.title missing for ${r.id}`);
    if (typeof r.encAmount !== "string") throw new Error(`Rule.encAmount missing for ${r.id}`);
    if (typeof r.maxCount !== "number") throw new Error(`Rule.maxCount missing for ${r.id}`);
  }

  return parsed as AwardRule[];
}

// Load once at startup (PH1)
const rules: AwardRule[] = loadAwardTable();

export function listAwardRules(): AwardRule[] {
  return rules;
}

export function getAwardRuleById(id: string): AwardRule | undefined {
  return rules.find((r) => r.id === id);
}
