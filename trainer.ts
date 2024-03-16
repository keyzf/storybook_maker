import { program } from "commander";

import { promisify } from "node:util";
import { exec } from "child_process";
import { trainStableDiffusionLora } from "./apis";
import { WebUiManager } from "./WebUiManager";

const execAsync = promisify(exec);

program
  .option("-p, --path <path>", "path to the training images")
  .option("-n, --name <name>", "name for the new model")
  .parse();

const {
  path,
  name: modelName,
}: {
  path: string;
  name: string;
} = program.opts();

async function runTrainer(name: string, path: string) {
  const webUi = new WebUiManager();
  await webUi.startProcess();
  trainStableDiffusionLora(name, path);
  await webUi.monitorLogsTill(
    `outputs/easyphoto-user-id-infos/${name}/user_weights/pytorch_lora_weights.safetensors`
  );
  // A bit hacky, but give it an extra couple of seconds to ensure it's finished before killing the process.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await webUi.stopProcess();
  return 0;
}

runTrainer(modelName, path);
