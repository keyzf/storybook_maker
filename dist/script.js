"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const commander_1 = require("commander");
const apis_1 = require("./apis");
const templateGenerator_1 = require("./template/templateGenerator");
const WebUiManager_1 = require("./WebUiManager");
commander_1.program
    .option("-m, --model <model>", "ollama model to use", "mistral")
    /*
      List:
        - cyberrealistic_classicV31, dreamshaper_8, LZ-16K+Optics, realismEngine_v10
        - v1-5-pruned
    */
    .option("-msd, --modelStableDiffusion <model>", "stable diffusion model to use", "dreamshaper_8")
    .option("-g, --genre <title>", "genre of the story", "children's story")
    .option("-p, --storyPlot <prompt>", "suggested plot for the hero of the story", "")
    .option("-h, --hero <name>", "name of the protagonist", "Gavin")
    .option("-hd, --heroDescription <description>", "description of the protagonist for the story", "a boy toddler")
    .option("-pd, --physicalDescription <description>", "tag based description of the protagonist for rendering", "1boy, toddler, solo")
    .option("-pg, --pages <page>", "number of pages to generate", "5")
    .option("-l, --lora <lora>", "lora to use", "gavin-15")
    .option("-lw, --loraWeight", "weight of the lora", "1")
    .option("-pr, --prompt <prompt>", `additional details to provide to the prompt - should just specify what the overall image looks like`, "")
    .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
    .option("-st, --steps <steps>", "number of steps to use in rendering", "30")
    .option("-x, --width <width>", "width of the image", "512")
    .option("-y, --height <height>", "height of the image", "512")
    .parse();
async function makeStory() {
    var _a, _b;
    const opts = commander_1.program.opts();
    console.log("Options: ", opts);
    const { model, modelStableDiffusion, genre, storyPlot, hero, heroDescription, physicalDescription, pages, lora, loraWeight, prompt, sampler, steps, width, height, } = commander_1.program.opts();
    // Ensure that the targeted lora exists. Saves us time if something went wrong.
    await (0, promises_1.access)(`/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Lora/${lora}.safetensors`);
    const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${storyPlot ? `where ${storyPlot} ` : ""}in ${pages} separate parts. Do not describe hair, eye, or skin colour.

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains an object with the following format: { "paragraph": the paragraph as a string}`;
    let currentContext = null;
    const { response: story, context: storyContext } = await (0, apis_1.getStoryPages)(fullPrompt, model);
    currentContext = storyContext;
    const { response: storyName, context: storyNameContext } = await (0, apis_1.getOllamaString)(`What would be a good name for this story? Make it brief and catchy. Respond in JSON with the following format: {
        "story_name": the name as a string
      }`, model, currentContext);
    currentContext = storyNameContext;
    const characterNamePromopt = `Tell me names we can use to refer to the people and animals in the story. Only include important characters.
    Respond in JSON by placing a an array of the names as strings in a key called names`;
    const characterNamesResp = await (0, apis_1.getOllamaString)(characterNamePromopt, model, storyContext);
    const characterNameRespJson = JSON.parse(characterNamesResp.response);
    currentContext = characterNamesResp.context;
    const characterDescriptionMap = {};
    for (const [index, { paragraph }] of Object.entries(story)) {
        const checkPrompt = `Using this paragraph, tell me whether any people or animals other than ${hero} are visible: "${paragraph}".
      Refer to them by name from this list: ${characterNameRespJson.names.join(", ")}. 
      Only include the names of the people and animals that are explicitly mentioned.
      Respond in JSON with the following format: {
        "people": a list of the people,
        "animals": a list of the animals
      }
    `;
        const checkResp = await (0, apis_1.getOllamaString)(checkPrompt, model, currentContext);
        currentContext = checkResp.context;
        const checkRespJson = JSON.parse(checkResp.response);
        const filteredCharacters = [
            ...(((_a = checkRespJson.people) === null || _a === void 0 ? void 0 : _a.filter((x) => { var _a; return !((_a = x === null || x === void 0 ? void 0 : x.toLowerCase()) === null || _a === void 0 ? void 0 : _a.includes(hero.toLowerCase())); })) || []),
            ...(((_b = checkRespJson.animals) === null || _b === void 0 ? void 0 : _b.filter((x) => { var _a; return !((_a = x === null || x === void 0 ? void 0 : x.toLowerCase()) === null || _a === void 0 ? void 0 : _a.includes(hero.toLowerCase())); })) || []),
        ];
        const backgroundPrompt = `Be creative and in a sentence or two describe what the scene looks like in this paragraph in a sentence or two: "${paragraph}".
      Do not describe ${hero}.
      Respond in JSON with the following format: {
        "background": the description as a string - do not return an array
      }
    `;
        const background = await (0, apis_1.getOllamaString)(backgroundPrompt, model, currentContext);
        const backgroundJson = JSON.parse(background.response);
        currentContext = background.context;
        story[index].background = backgroundJson.background;
        for (const character of filteredCharacters) {
            if (!characterDescriptionMap[character]) {
                const descriptionPrompt = `Be creative describe what ${character} looks like.
         Include their gender as "a man", or "a woman".  
         Include their ethnicity.
         Do not describe ${hero}.
         Respond in JSON with the following format: {
           "description": the description as a string - do not return an array
         }
        `;
                const characterDescription = await (0, apis_1.getOllamaString)(descriptionPrompt, model, currentContext);
                const characterDescriptionJson = JSON.parse(characterDescription.response);
                currentContext = characterDescription.context;
                characterDescriptionMap[character] =
                    characterDescriptionJson.description
                        //.split(",")
                        //.slice(0, 5)
                        .toString();
            }
        }
        if (filteredCharacters[0]) {
            const descriptionPrompt = `Be creative and in a sentence or two describe how ${filteredCharacters[0]} would react to this paragraph: "${paragraph}". 
        Do not describe ${hero}.
        Respond in JSON with the following format: {
          "description": the description as a string - do not return an array
        }
      `;
            //const descriptionPrompt = "say poop";
            const description = await (0, apis_1.getOllamaString)(descriptionPrompt, model, currentContext);
            const descriptionJson = JSON.parse(description.response);
            currentContext = description.context;
            story[index].other_characters = `${characterDescriptionMap[filteredCharacters[0]]
                //.split(",")
                //.slice(0, 5)
                .toString()} ${descriptionJson.description
                //.split(",")
                //.slice(0, 5)
                .toString()}`;
        }
        // FIXME: Better naming here - this should be more like the physical description I think
        const heroDescriptionPrompt = `Be creative and in a sentence or two describe how ${hero} would react to this paragraph: "${paragraph}" 
      Ensure we respect their description: ${physicalDescription}. 
      Do not describe hair, eye, or skin colour.
      ${filteredCharacters[0] ? `Do not describe ${filteredCharacters[0]}.` : ""}
      Respond in JSON with the following format: {
        "description": the description as a string - do not return an array
      }`;
        const heroDescription = await (0, apis_1.getOllamaString)(heroDescriptionPrompt, model, currentContext);
        currentContext = heroDescription.context;
        const heroDescriptionJson = JSON.parse(heroDescription.response);
        story[index].paragraph_tags = heroDescriptionJson.description
            //.split(",")
            //.slice(0, 5)
            .toString();
    }
    console.log("### Character Descriptions: ", JSON.stringify(characterDescriptionMap, null, 2));
    const directoryPath = Math.floor(Date.now() / 1000).toString();
    await (0, promises_1.mkdir)(`./stories/${directoryPath}`, { recursive: true });
    const webUi = new WebUiManager_1.WebUiManager();
    await webUi.startProcess();
    const imageBlobs = [];
    // Set the appropriate model.
    await (0, apis_1.setStableDiffusionModelCheckpoint)(modelStableDiffusion);
    for (const [index, storyPage] of story.entries()) {
        console.log(storyPage);
        const images = await (0, apis_1.getStableDiffusionImages)({
            prompt,
            steps,
            width,
            height,
            storyPage,
            lora,
            loraWeight,
            sampler,
            physicalDescription,
            useRegions: !!storyPage.other_characters,
            urlBase: "127.0.0.1:7860",
        });
        for (const [imageIndex, image] of images.entries()) {
            await (0, promises_1.writeFile)(`./stories/${directoryPath}/${index}-${imageIndex}.png`, Buffer.from(image, "base64"));
            if (!imageBlobs[index])
                imageBlobs[index] = [Buffer.from(image, "base64")];
            else
                imageBlobs[index].push(Buffer.from(image, "base64"));
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
        paragraph_tags: physicalDescription,
        background: "a vibrant sunset",
        other_characters: [],
      },
      lora,
      loraWeight,
      physicalDescription: `looking at the camera, smiling, ${physicalDescription}`,
      useRegions: false,
      urlBase: "127.0.0.1:7860",
    });*/
    const storyMetadata = {
        characterDescriptionMap,
        lora,
        loraWeight,
        steps,
        sampler,
        width,
        height,
        physicalDescription,
        prompt,
        useRegions: story.map((x) => { var _a; return !!((_a = x.other_characters) === null || _a === void 0 ? void 0 : _a.length); }),
    };
    await Promise.all([
        (0, promises_1.writeFile)(`./stories/${directoryPath}/index.html`, (0, templateGenerator_1.getTemplate)(story, false)),
        /*...titlePageImages.map((image, index) =>
          writeFile(
            `./stories/${directoryPath}/title-${index}.png`,
            Buffer.from(image as string, "base64")
          )
        ),*/
        (0, promises_1.writeFile)(`./stories/${directoryPath}/story.json`, JSON.stringify(story)),
        (0, promises_1.writeFile)(`./stories/${directoryPath}/metadata.json`, JSON.stringify(storyMetadata)),
        (0, promises_1.copyFile)("./template/HobbyHorseNF.otf", `./stories/${directoryPath}/HobbyHorseNF.otf`),
    ]);
    webUi.stopProcess();
    return 0;
}
makeStory();
//# sourceMappingURL=script.js.map