export {};

const args = process.argv.slice(2);

if (args.includes("--server") || args.includes("-s")) {
  const { startGateway } = await import("./gateway/server.js");
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1] ?? "3000") : 3000;
  await startGateway(port);
} else {
  const { startCli } = await import("./cli/index.js");
  await startCli();
}
