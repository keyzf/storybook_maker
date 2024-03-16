import { createInterface } from "node:readline";
import { writeFile, readFile, access } from "node:fs/promises";
import { argv } from "node:process";
import terminate from "terminate";
import { getTemplate } from "./template/templateGenerator";

// Script to edit a created story - allows for the user to choose the best images for the story.

async function editStory() {
  const path = argv[2];
  await access(path);
  const editedPath = path.replace("./", "");
  const open = await import("open").then((m) => m.default);
  const chosenBlobs: Buffer[] = [];
  // Prompt the user to choose the best images for the story.
  const iface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const story = JSON.parse(
    await readFile(`./${editedPath}/story.json`, "utf-8")
  );

  for (const [index, storyPage] of story.entries()) {
    console.log("Story Page: ", storyPage);
    const imageProcess = await open(
      `${process.cwd()}/${editedPath}/${index}-0.png`,
      { allowNonzeroExitCode: true }
    );

    let imageNumber: number = null;
    iface.on("line", (answer) => {
      const trimmed = answer.trim();
      if (Number.isNaN(trimmed)) return;

      imageNumber = parseInt(trimmed);
    });

    while (!imageNumber) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    terminate(imageProcess.pid);
    chosenBlobs.push(
      await readFile(`./${editedPath}/${index}-${imageNumber}.png`)
    );
  }

  iface.close();

  await writeFile(
    `./${editedPath}/index.html`,
    getTemplate(story, chosenBlobs)
  );
}

editStory();
