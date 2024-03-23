import { createInterface } from "node:readline";
import { exec } from "child_process";
import { writeFile, readFile, access } from "node:fs/promises";
import { argv } from "node:process";
import terminate from "terminate";
import { getTemplate } from "./template/templateGenerator";
import sharp from "sharp";
import { StoryMetadata, StoryPage } from "./types";
import { WebUiManager } from "./WebUiManager";
import { getUpscaledStableDiffusionImages } from "./apis";

// Script to edit a created story - allows for the user to choose the best images for the story.

async function editStory() {
  const path = argv[2];
  await access(path);
  const editedPath = path.replace("./", "");
  const chosenImages: number[] = [];

  // Prompt the user to choose the best images for the story.
  const iface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const story: StoryPage[] = JSON.parse(
    await readFile(`./${editedPath}/story.json`, "utf-8")
  );
  const metadata: StoryMetadata = JSON.parse(
    await readFile(`./${editedPath}/metadata.json`, "utf-8")
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

    chosenImages.push(imageNumber);

    terminate(imageProcess.pid, "SIGKILL");
  }

  iface.close();

  // FIXME: Might be good to see if stable diffusion is already running.
  const webUi = new WebUiManager();
  await webUi.startProcess();

  // FIXME: Save the used checkpoint on the story so we can return later.
  //await setStableDiffusionModelCheckpoint(metadata.sampler);

  const upscaledImages = await getUpscaledStableDiffusionImages({
    lora: metadata.lora,
    steps: metadata.steps,
    width: Number(metadata.width),
    height: Number(metadata.height),
    images: await Promise.all(
      chosenImages.map(async (imageNumber, index) =>
        (
          await readFile(`./${editedPath}/${index}-${imageNumber}.png`)
        ).toString("base64")
      )
    ),
    physicalDescription: metadata.physicalDescription,
    storyPages: story,
    prompt: metadata.prompt, // FIXME?: I don't know if we use this anywhere
    sampler: metadata.sampler,
  });

  // FIXME: Need this to loop through the stable diffusion results.
  /*chosenBlobs.push(
    await sharp(`./${editedPath}/${index}-${imageNumber}.png`)
      .jpeg({ quality: 98 })
      .toBuffer()
  );*/

  await webUi.stopProcess();

  await Promise.all(
    upscaledImages.map((image, index) =>
      sharp(Buffer.from(image, "base64"))
        .jpeg({ quality: 98 })
        .toFile(`./${editedPath}/final-${index}.jpg`)
    )
  );

  await writeFile(`./${editedPath}/index.html`, getTemplate(story, true));
}

editStory();
