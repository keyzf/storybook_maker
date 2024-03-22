import { mkdir, writeFile, copyFile, access } from "node:fs/promises";
import { program } from "commander";
import {
  getStoryPages,
  setStableDiffusionModelCheckpoint,
  getOllamaString,
  getStableDiffusionImages,
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
    "description of the protagonist for the story",
    "a boy toddler"
  )
  .option(
    "-pd, --physicalDescription <description>",
    "tag based description of the protagonist for rendering",
    "1boy, white, toddler, solo"
  )
  .option("-pg, --pages <page>", "number of pages to generate", "5")
  .option("-l, --lora <lora>", "lora to use", "gavin-15")
  .option("-lw, --loraWeight", "weight of the lora", "1")
  .option(
    "-pr, --prompt <prompt>",
    `additional details to provide to the prompt - should just specify what the overall image looks like`,
    ""
  )
  .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
  .option("-st, --steps <steps>", "number of steps to use in rendering", "25")
  .option("-x, --width <width>", "width of the image", "512")
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

  // Ensure that the targeted lora exists. Saves us time if something went wrong.
  await access(
    `/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Lora/${lora}.safetensors`
  );

  const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${
    storyPlot ? `where ${storyPlot} ` : ""
  }in ${pages} separate parts. Do not describe hair, eye, or skin colour.

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains an object with the following format: {
    "paragraph": the paragraph,
    "background": descriptive comma separated tags describing the background
  }`;

  let currentContext: number[] = null;
  const { response: story, context: storyContext } = await getStoryPages(
    fullPrompt,
    model
  );
  currentContext = storyContext;

  const { response: storyName, context: storyNameContext } =
    await getOllamaString(
      `What would be a good name for this story? Make it brief and catchy. Respond in JSON with the following format: {
        "story_name": the name as a string
      }`,
      model,
      currentContext
    );
  currentContext = storyNameContext;

  const characterNamePromopt = `Tell me names we can use to refer to the people and animals in the story.
    Respond in JSON by placing a an array of the names as strings in a key called names`;
  const characterNamesResp = await getOllamaString(
    characterNamePromopt,
    model,
    storyContext
  );
  const characterNameRespJson: {
    names: string[];
  } = JSON.parse(characterNamesResp.response);
  currentContext = characterNamesResp.context;

  const characterDescriptionMap: Record<string, string> = {};
  for (const [index, { paragraph }] of Object.entries(story)) {
    const checkPrompt = `Using this paragraph, tell me whether any people or animals other than ${hero} are visible: "${paragraph}".
      Refer to them by name from this list: ${characterNameRespJson.names.join(
        ","
      )}. 
      Respond in JSON with the following format: {
        "people": a list of the people,
        "animals": a list of the animals
      }
    `;
    const checkResp = await getOllamaString(checkPrompt, model, currentContext);
    currentContext = checkResp.context;
    const checkRespJson: {
      people: string[];
      animals: string[];
    } = JSON.parse(checkResp.response);

    const filteredCharacters = [
      ...(checkRespJson.people?.filter(
        (x) => !x?.toLowerCase()?.includes(hero.toLowerCase())
      ) || []),
      ...(checkRespJson.animals?.filter(
        (x) => !x?.toLowerCase()?.includes(hero.toLowerCase())
      ) || []),
    ];

    for (const character of filteredCharacters) {
      if (!characterDescriptionMap[character]) {
        const descriptionPrompt = `Be creative and provide simple verbs and nouns separated by commas to describe what ${character} looks like.
         Include their gender as "a man", or "a woman".  
         Include their ethnicity.
         Do not describe ${hero}.
         Respond in JSON with the following format: {
           "description": the description as a string - do not return an array
         }
        `;
        const characterDescription = await getOllamaString(
          descriptionPrompt,
          model,
          currentContext
        );
        const characterDescriptionJson: {
          description: string;
        } = JSON.parse(characterDescription.response);
        currentContext = characterDescription.context;
        characterDescriptionMap[character] =
          characterDescriptionJson.description
            .split(",")
            .slice(0, 5)
            .toString();
      }
    }

    if (filteredCharacters[0]) {
      const descriptionPrompt = `Be creative and provide simple verbs and nouns separated by commas to describe how ${filteredCharacters[0]} would react to this paragraph: "${paragraph}". 
        Do not describe ${hero}.
        Respond in JSON with the following format: {
          "description": the description as a string - do not return an array
        }
      `;
      //const descriptionPrompt = "say poop";
      const description = await getOllamaString(
        descriptionPrompt,
        model,
        currentContext
      );
      const descriptionJson: {
        description: string;
      } = JSON.parse(description.response);
      currentContext = description.context;

      story[index].other_characters = descriptionJson.description
        .split(",")
        .slice(0, 5)
        .toString();
    }

    // FIXME: Better naming here - this should be more like the physical description I think
    const heroDescriptionPrompt = `Be creative and provide simple verbs and nouns separated by commas to describe how ${hero} would react to this paragraph: "${paragraph}" 
      Ensure we respect their description: ${physicalDescription}. 
      Do not describe ${filteredCharacters[0]}.
      Respond in JSON with the following format: {
        "description": the description as a string - do not return an array
      }`;
    const heroDescription = await getOllamaString(
      heroDescriptionPrompt,
      model,
      currentContext
    );
    currentContext = heroDescription.context;
    const heroDescriptionJson: {
      description: string;
    } = JSON.parse(heroDescription.response);
    story[index].paragraph_tags = heroDescriptionJson.description
      .split(",")
      .slice(0, 5)
      .toString();
  }

  console.log(
    "### Character Descriptions: ",
    JSON.stringify(characterDescriptionMap, null, 2)
  );

  const directoryPath = Math.floor(Date.now() / 1000).toString();
  await mkdir(`./stories/${directoryPath}`, { recursive: true });

  const webUi = new WebUiManager();
  await webUi.startProcess();

  const imageBlobs: Buffer[][] = [];

  // Set the appropriate model.
  await setStableDiffusionModelCheckpoint(modelStableDiffusion);

  for (const [index, storyPage] of story.entries()) {
    console.log(storyPage);

    const images = await getStableDiffusionImages({
      prompt,
      sampler,
      steps,
      width,
      height,
      storyPage,
      lora,
      loraWeight,
      physicalDescription,
      characterDescriptionMap,
      // We can go faster if we only use regions every few pages.
      // Can also end up with some better action shots as a result.
      useRegions: !!storyPage.other_characters,
      urlBase: "127.0.0.1:7860",
    });

    for (const [imageIndex, image] of images.entries()) {
      await writeFile(
        `./stories/${directoryPath}/${index}-${imageIndex}.png`,
        Buffer.from(image as string, "base64")
      );
      if (!imageBlobs[index])
        imageBlobs[index] = [Buffer.from(image as string, "base64")];
      else imageBlobs[index].push(Buffer.from(image as string, "base64"));
    }
  }

  // Make up a title page image for the story.
  const titlePageImages = await getStableDiffusionImages({
    prompt,
    sampler,
    steps,
    width,
    height,
    storyPage: {
      paragraph: ``,
      paragraph_tags: physicalDescription,
      background: "a vibrant sunset",
    },
    lora,
    loraWeight,
    physicalDescription: `looking at the camera, smiling, ${physicalDescription}`,
    characterDescriptionMap,
    useRegions: false,
    urlBase: "127.0.0.1:7860",
  });

  await Promise.all([
    writeFile(
      `./stories/${directoryPath}/index.html`,
      getTemplate(
        story,
        // Send through the previews before we edit.
        imageBlobs.map((x) => x[0])
      )
    ),
    ...titlePageImages.map((image, index) =>
      writeFile(
        `./stories/${directoryPath}/title-${index}.png`,
        Buffer.from(image as string, "base64")
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
