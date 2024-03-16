import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { program } from "commander";
import {
  getStableDiffusionImageBlob,
  getStoryPages,
  setStableDiffusionModelCheckpoint,
} from "./apis";
import { getTemplate } from "./template/templateGenerator";
import { WebUiManager } from "./WebUiManager";

program
  .option("-m, --model <model>", "ollama model to use", "mistral")
  /* 
    List:
      - cyberrealistic_classicV31, dreamshaper_8, LZ-16K+Optics, realismEngine_v10
      - v1-5-pruned
  */
  .option(
    "-msd, --modelStableDiffusion <model>",
    "stable diffusion model to use",
    "dreamshaper_8"
  )
  .option("-g, --genre <title>", "genre of the story", "children's story")
  .option(
    "-p, --storyPlot <prompt>",
    "suggested plot for the hero of the story",
    ""
  )
  .option("-h, --hero <name>", "name of the protagonist", "Gavin")
  .option(
    "-hd, --heroDescription <description>",
    "description of the protagonist",
    "a boy toddler"
  )
  .option(
    "-pd, --physicalDescription <description>",
    "physical description of the protagonist - used in rendering",
    "white, boy, toddler"
  )
  .option("-pg, --pages <page>", "number of pages to generate", "5")
  .option("-l, --lora <lora>", "lora to use", "gavin-15")
  .option("-lw, --loraWeight", "weight of the lora", "1.1")
  .option(
    "-pr, --prompt <prompt>",
    `additional details to provide to the prompt - should just specify what the overall image looks like`,
    "masterpiece, best quality, highres, extremely clear 8k wallpaper"
  )
  .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
  .option("-st, --steps <steps>", "number of steps to use in rendering", "40")
  .option("-x, --width <width>", "width of the image", "512")
  .option("-y, --height <height>", "height of the image", "768")
  .parse();

async function makeStory() {
  const opts = program.opts();
  console.log("Options: ", opts);

  const {
    model,
    modelStableDiffusion,
    genre,
    storyPlot,
    hero,
    heroDescription,
    physicalDescription,
    pages,
    lora,
    loraWeight,
    prompt,
    sampler,
    steps,
    width,
    height,
  }: {
    model: string;
    modelStableDiffusion: string;
    genre: string;
    storyPlot: string;
    hero: string;
    heroDescription: string;
    physicalDescription: string;
    pages: string;
    lora: string;
    loraWeight: string;
    prompt: string;
    sampler: string;
    steps: string;
    width: string;
    height: string;
  } = program.opts();

  const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${
    storyPlot ? `where ${storyPlot} ` : ""
  }in ${pages} separate parts.

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains 
    a paragraph key: the paragraph, 
    a description key: a list of the physical entities in the scene (excluding the protagonist), 
    and a background key: a short description of the surroundings.`;
  console.log("Prompt being given to ollama: ", fullPrompt);

  const story = await getStoryPages(fullPrompt, model);

  const directoryPath = Math.floor(Date.now() / 1000).toString();
  await mkdir(`./stories/${directoryPath}`, { recursive: true });

  const webUi = new WebUiManager();
  await webUi.startProcess();

  const imageBlobs: Buffer[][] = [];

  // Set the appropriate model.
  await setStableDiffusionModelCheckpoint(modelStableDiffusion);

  for (const [index, storyPage] of story.entries()) {
    const imageBlob = await getStableDiffusionImageBlob({
      prompt,
      sampler,
      steps,
      width,
      height,
      storyPage,
      lora,
      loraWeight,
      hero,
      physicalDescription,
      // We can go faster if we only use regions every few pages.
      // Can also end up with some better action shots as a result.
      useRegions: storyPage.description.length && index % 2 === 0,
      urlBase: "127.0.0.1:7860",
    });

    for (const [imageIndex, image] of Object.entries(
      JSON.parse(await imageBlob.text()).images
    )) {
      await writeFile(
        `./stories/${directoryPath}/${index}-${imageIndex}.png`,
        Buffer.from(image as string, "base64")
      );
      if (!imageBlobs[index])
        imageBlobs[index] = [Buffer.from(image as string, "base64")];
      else imageBlobs[index].push(Buffer.from(image as string, "base64"));
    }
  }

  await Promise.all([
    writeFile(
      `./stories/${directoryPath}/index.html`,
      getTemplate(
        story,
        // Send through the previews before we edit.
        imageBlobs.map((x) => x[0])
      )
    ),
    writeFile(`./stories/${directoryPath}/story.json`, JSON.stringify(story)),
    copyFile(
      "./template/HobbyHorseNF.otf",
      `./stories/${directoryPath}/HobbyHorseNF.otf`
    ),
  ]);

  webUi.stopProcess();
  return 0;
}

makeStory();
