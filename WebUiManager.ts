import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import terminate from "terminate";

export class WebUiManager {
  protected process: ChildProcessWithoutNullStreams;
  protected monitorCondition: string = null;
  protected ready: boolean = false;

  async startProcess(): Promise<void> {
    if (this.process) {
      console.warn(
        "Webui process already running. Ignoring request to start again."
      );
      return;
    }

    this.process = spawn("./webui.sh", [], {
      cwd: "/home/kyle/Development/stable_diffusion/stable-diffusion-webui/",
    });

    this.process.stdout.on("data", (data) => {
      if (data.includes("Running on local URL")) {
        this.ready = true;
      }

      if (this.monitorCondition && data.includes(this.monitorCondition)) {
        this.monitorCondition = null;
      }

      console.log("[WebUiManager]: ", data.toString());
    });

    this.process.stderr.on("data", (data) => {
      console.error("[WebUiManager]: ", data.toString());
    });

    this.process.on("close", (code) => {
      this.ready = false;
      this.process = null;
    });

    while (!this.ready) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Wait another second because sometimes it's not quite ready yet.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async monitorLogsTill(condition: string): Promise<void> {
    this.monitorCondition = condition;

    // This should eventually resolve in the stdout data watcher.
    while (this.monitorCondition) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  isReady(): boolean {
    return this.process && this.ready;
  }

  stopProcess() {
    this.process.stdout.destroy();
    this.process.stderr.destroy();
    terminate(this.process.pid);
  }
}
