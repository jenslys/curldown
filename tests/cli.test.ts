import { registerCliMainModuleSuite } from "./cli-main-module.suite.js";
import { registerCliRunErrorsSuite } from "./cli-run-errors.suite.js";
import { registerCliRunPathsSuite } from "./cli-run-paths.suite.js";

registerCliMainModuleSuite();
registerCliRunPathsSuite();
registerCliRunErrorsSuite();
