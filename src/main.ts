import {
  mu,
  applyLayoutFromConfig,
  getConfig,
} from "@ursamu/mush";

const game = await mu(undefined, undefined, {
  pluginsDir: "",
});

applyLayoutFromConfig(
  getConfig<{
    header?: string;
    divider?: string;
    footer?: string;
  }>("game.layout"),
);

console.log(
  `${game.config.get("game.name")} main server is running!`,
);
