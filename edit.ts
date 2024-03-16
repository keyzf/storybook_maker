import { createInterface } from "node:readline";
import { exec } from "child_process";
import { writeFile, readFile, access } from "node:fs/promises";
import { argv } from "node:process";
import terminate from "terminate";
import { getTemplate } from "./template/templateGenerator";
import sharp from "sharp";

// Script to edit a created story - allows for the user to choose the best images for the story.

async function editStory() {
  const path = argv[2];
  await access(path);
  const editedPath = path.replace("./", "");
  const open = await import("open");
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
    const imageProcess = exec(
      `/usr/bin/display ${process.cwd()}/${editedPath}/${index}-0.png`
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

    terminate(imageProcess.pid, "SIGKILL");
    chosenBlobs.push(
      await sharp(`./${editedPath}/${index}-${imageNumber}.png`)
        .jpeg({ quality: 98 })
        .toBuffer()
    );
  }

  iface.close();

  await writeFile(
    `./${editedPath}/index.html`,
    getTemplate(story, chosenBlobs)
  );
}

editStory();
