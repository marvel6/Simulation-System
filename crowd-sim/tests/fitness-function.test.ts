import { fitnessH } from "../packages/shared/src/fitness.js";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const balanced = [50, 50, 50, 50];
const skewed = [200, 0, 0, 0];

const hBalanced = fitnessH(balanced);
const hSkewed = fitnessH(skewed);

assert(hSkewed > hBalanced, `Expected skewed H (${hSkewed}) > balanced H (${hBalanced})`);
assert(fitnessH([]) === 0, "empty should be 0");
assert(fitnessH([0, 0, 0, 0]) === 0, "all-zero should be 0");

console.log("fitness-function.test.ts OK", { hBalanced, hSkewed });
