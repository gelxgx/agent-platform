import { startCli } from "./cli/index.js";

startCli().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
