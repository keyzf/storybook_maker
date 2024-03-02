import { mkdir, writeFile } from "node:fs/promises";
import { program } from "commander";
import { getStableDiffusionImageBlob, getStoryPages } from "./apis";

program
  .option("-m, --model <model>", "ollama model to use", "mistral")
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
  .option("-pg, --pages <page>", "number of pages to generate", "5")
  .option("-l, --lora <lora>", "lora to use", "el gavin")
  .option("-lw, --loraWeight", "weight of the lora", "1")
  .option(
    "-pr, --prompt <prompt>",
    `additional details to provide to the prompt - should just specify what the overall image looks like`,
    "masterpiece, best quality, highres, extremely clear 8k wallpaper"
  )
  .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
  .option("-st, --steps <steps>", "number of steps to use in rendering", "35")
  .option("-x, --width <width>", "width of the image", "768")
  .option("-y, --height <height>", "height of the image", "512")
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

  for (const [index, storyPage] of story.entries()) {
    const imageBlob = await getStableDiffusionImageBlob({
      prompt,
      modelStableDiffusion,
      sampler,
      steps,
      width,
      height,
      storyPage,
      lora,
      loraWeight,
      hero,
      heroDescription,
      urlBase: "127.0.0.1:7860",
    });

    for (const [imageIndex, image] of Object.entries(
      JSON.parse(await imageBlob.text()).images
    )) {
      await writeFile(
        `./stories/${directoryPath}/${index}-${imageIndex}.png`,
        Buffer.from(image as string, "base64")
      );
    }
  }

  await writeFile(
    `./stories/${directoryPath}/index.html`,
    `
  <html>
    <head>
      <title>Stories</title>
    </head>
    <body>
      <table>
        ${story
          .map(
            ({ paragraph }, index) =>
              `<tr><td><img src="./${index}-1.png" /></td></tr><tr><td><h1>${paragraph}</h1></td></tr>`
          )
          .join("")}
      </table>
    </body>
  <html>  
  `
  );

  return 0;
}

makeStory();
