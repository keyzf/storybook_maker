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
import { StoryMetadata } from "./types";

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
  .option("-hg, --heroGender <male|female>", "male")
  .option(
    "-htags, --heroTags <description>",
    "tag based description of the protagonist for rendering",
    "toddler"
  )
  .option(
    "-hd, --heroDescription <description>",
    "description of the protagonist for the story",
    "a boy toddler"
  )
  .option("-sh, --support <name>", "name of the supporting character", "")
  .option(
    "-sg, --supportGender <male|female>",
    "gender of the supporting character",
    ""
  )
  .option(
    "-stags, --supportTags <description>",
    "tag based description of the supporting character for rendering",
    ""
  )
  .option(
    "-sd, --supportDescription <description>",
    "description of the supporting character for the story",
    ""
  )
  .option("-l, --lora <lora>", "lora to use for the hero", "gavin-15")
  .option(
    "-sl, --supportLora <name>",
    "lora to use for the supporting character",
    ""
  )
  .option("-pg, --pages <page>", "number of pages to generate", "5")
  .option(
    "-pr, --prompt <prompt>",
    `additional details to provide to the prompt - should just specify what the overall image looks like`,
    "masterpiece, 8k, high resolution, high quality"
  )
  .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
  .option("-st, --steps <steps>", "number of steps to use in rendering", "40")
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
    heroGender,
    heroDescription,
    heroTags: inputHeroTags,
    support,
    supportGender,
    supportDescription,
    supportTags: inputSupportTags,
    lora,
    supportLora,
    pages,
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
    heroGender: string;
    heroDescription: string;
    heroTags: string;
    lora: string;
    support: string;
    supportGender: string;
    supportDescription: string;
    supportTags: string;
    supportLora: string;
    pages: string;
    prompt: string;
    sampler: string;
    steps: string;
    width: string;
    height: string;
  } = program.opts();

  const heroTags = `${heroGender}, ${inputHeroTags}`;
  const supportTags = `${supportGender}, ${inputSupportTags}`;

  // Ensure that the targeted lora exists. Saves us time if something went wrong.
  await access(
    `/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Lora/${lora}.safetensors`
  );

  const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${
    storyPlot ? `where ${storyPlot} ` : ""
  }in ${pages} separate parts. 
  Do not mention hair, eye, or skin colour.
  ${
    support.length
      ? `Include a person named ${support} that is ${supportDescription}.`
      : ""
  }

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains an object with the following format: { "paragraph": the paragraph as a string }`;

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
    Only include important characters.
    Include ${hero} in the list.
    ${support.length ? `Include ${support} in the list.` : ""}
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
  for (const [index, { paragraph }] of story.entries()) {
    const checkPrompt = `Using this paragraph, tell me whether any people or animals other than ${hero} are visible: "${paragraph}".
      Refer to them by name from this list: ${characterNameRespJson.names.join(
        ", "
      )}.
      Assume that any use of the word "they", "them", or "their" means the people and animals in the story.
      Only include the names of the people and animals that are explicitly mentioned.
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
        (x) => !x?.toLowerCase()?.includes(hero.toLowerCase()) && x?.length >= 1
      ) || []),
      ...(checkRespJson.animals?.filter(
        (x) => !x?.toLowerCase()?.includes(hero.toLowerCase()) && x?.length >= 1
      ) || []),
    ];

    if (support.length) {
      characterDescriptionMap[support] = `<lora:${supportLora}:1>${
        Math.random() < 0.5 ? `easyphoto_face, ` : ""
      }${supportTags}`;
    }

    for (const character of filteredCharacters) {
      if (!character.length) continue;

      if (!characterDescriptionMap[character]) {
        const descriptionPrompt = `Be creative and in a single sentence describe what ${character} looks like.
         Include their gender as "a man", or "a woman".  
         Include their ethnicity.
         Do not mention ${hero} or any other characters.

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
          characterDescriptionJson.description.toString();
      }
    }

    const character =
      filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];

    if (filteredCharacters.length) {
      const descriptionPrompt = `Be creative and in a single sentence describe how ${character} would react to this paragraph: "${paragraph}". 
        Do not mention ${hero} or any other characters.
        Do not use the words "they", "them", or "their".
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

      story[index].supportPrompt = `${characterDescriptionMap[
        character
      ].toString()}, ${descriptionJson.description.toString()}`;
    }

    const backgroundPrompt = `Be creative and in a sentence or two describe what the scene looks like in this paragraph: "${paragraph}".
    Do not mention ${hero}${
      story[index].supportPrompt ? `, ${character},` : ""
    } or any other characters.
    Respond in JSON with the following format: {
      "background": the description as a string - do not return an array
    }
  `;
    const background = await getOllamaString(
      backgroundPrompt,
      model,
      currentContext
    );
    const backgroundJson: {
      background: string;
    } = JSON.parse(background.response);
    currentContext = background.context;
    story[index].background = backgroundJson.background;

    if (checkRespJson.people?.includes(hero)) {
      const heroDescriptionPrompt = `Be creative and in a single sentence describe how ${hero} would react to this paragraph: "${paragraph}" 
      Ensure we respect their description: ${heroTags}. 
      Do not mention hair, eye, or skin colour.
      ${character ? `Do not mention ${character} or any other characters.` : ""}
      Do not use the words "they", "them", or "their".
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
      story[index].heroPrompt = `<lora:${lora}:1>${
        Math.random() < 0.5 ? `easyphoto_face, ` : ""
      }${heroTags}, ${heroDescriptionJson.description.toString()}`;
    }
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
      steps,
      width,
      height,
      storyPage,
      sampler,
      useRegions: !!(storyPage.heroPrompt && storyPage.supportPrompt),
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

  // TODO: Need to make the template be ready for this.
  // Make up a title page image for the story.
  /*const titlePageImages = await getStableDiffusionImages({
    prompt,
    steps,
    width,
    height,
    storyPage: {
      paragraph: ``,
      hero_description: physicalDescription,
      background: "a vibrant sunset",
      other_characters: [],
    },
    lora,
    loraWeight,
    physicalDescription: `looking at the camera, smiling, ${physicalDescription}`,
    useRegions: false,
    urlBase: "127.0.0.1:7860",
  });*/

  const storyMetadata: StoryMetadata = {
    characterDescriptionMap,
    lora,
    steps,
    sampler,
    width,
    height,
    heroTags,
    prompt,
    useRegions: story.map((x) => !!(x.heroPrompt && x.supportPrompt)),
  };

  await Promise.all([
    writeFile(
      `./stories/${directoryPath}/index.html`,
      getTemplate(story, false)
    ),
    /*...titlePageImages.map((image, index) =>
      writeFile(
        `./stories/${directoryPath}/title-${index}.png`,
        Buffer.from(image as string, "base64")
      )
    ),*/
    writeFile(`./stories/${directoryPath}/story.json`, JSON.stringify(story)),
    writeFile(
      `./stories/${directoryPath}/metadata.json`,
      JSON.stringify(storyMetadata)
    ),
    copyFile(
      "./template/HobbyHorseNF.otf",
      `./stories/${directoryPath}/HobbyHorseNF.otf`
    ),
  ]);

  webUi.stopProcess();
  return 0;
}

makeStory();
