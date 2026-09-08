import { startTelnetServer } from "@ursamu/mush";
import { getConfig, initConfig } from "@ursamu/core";

await initConfig();
const wsPort =
  getConfig<number>("server.wsPort") ??
  getConfig<number>("server.ws") ??
  4202;

await startTelnetServer({ wsPort });

console.log(`Telnet server is running! (hub ws://localhost:${wsPort})`);
