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
    .option("-pd, --physicalDescription <description>", "tag based description of the protagonist for rendering", "1boy, white, toddler, solo")
    .option("-pg, --pages <page>", "number of pages to generate", "5")
    .option("-l, --lora <lora>", "lora to use", "gavin-15")
    .option("-lw, --loraWeight", "weight of the lora", "1")
    .option("-pr, --prompt <prompt>", `additional details to provide to the prompt - should just specify what the overall image looks like`, "")
    .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
    .option("-st, --steps <steps>", "number of steps to use in rendering", "50")
    .option("-x, --width <width>", "width of the image", "512")
    .option("-y, --height <height>", "height of the image", "512")
    .parse();
async function makeStory() {
    var _a, _b, _c;
    const opts = commander_1.program.opts();
    console.log("Options: ", opts);
    const { model, modelStableDiffusion, genre, storyPlot, hero, heroDescription, physicalDescription, pages, lora, loraWeight, prompt, sampler, steps, width, height, } = commander_1.program.opts();
    // Ensure that the targeted lora exists. Saves us time if something went wrong.
    await (0, promises_1.access)(`/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Lora/${lora}.safetensors`);
    const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${storyPlot ? `where ${storyPlot} ` : ""}in ${pages} separate parts. Do not describe hair, eye, or skin colour.

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains an object with the following format: {
    "paragraph": the paragraph,
    "paragraph_tags": descriptive comma separated tags describing ${hero},
    "background": descriptive comma separated tags describing the background
  }`;
    let currentContext = null;
    const { response: story, context: storyContext } = await (0, apis_1.getStoryPages)(fullPrompt, model);
    currentContext = storyContext;
    const characterNamePromopt = `Tell me names we can use to refer to the people and animals in the story.
    Respond in JSON by placing a an array of the names as strings in a key called names`;
    const characterNamesResp = await (0, apis_1.getOllamaString)(characterNamePromopt, model, storyContext);
    const characterNameRespJson = JSON.parse(characterNamesResp.response);
    currentContext = characterNamesResp.context;
    const characterDescriptionMap = {};
    for (const [index, { paragraph }] of Object.entries(story)) {
        const checkPrompt = `Using this paragraph, tell me whether any people or animals other than ${hero} are visible: "${paragraph}".
      Refer to them by name from this list: ${characterNameRespJson.names.join(",")}. 
      Respond in JSON with the following format: {
        "people": a list of the people,
        "animals": a list of the animals
      }
    `;
        const checkResp = await (0, apis_1.getOllamaString)(checkPrompt, model, currentContext);
        currentContext = checkResp.context;
        const checkRespJson = JSON.parse(checkResp.response);
        const filteredCharacters = [
            ...(((_a = checkRespJson === null || checkRespJson === void 0 ? void 0 : checkRespJson.people) === null || _a === void 0 ? void 0 : _a.filter((x) => { var _a; return !((_a = x === null || x === void 0 ? void 0 : x.toLowerCase()) === null || _a === void 0 ? void 0 : _a.includes(hero.toLowerCase())); })) || []),
            ...(((_b = checkRespJson === null || checkRespJson === void 0 ? void 0 : checkRespJson.animals) === null || _b === void 0 ? void 0 : _b.filter((x) => { var _a; return !((_a = x === null || x === void 0 ? void 0 : x.toLowerCase()) === null || _a === void 0 ? void 0 : _a.includes(hero.toLowerCase())); })) || []),
        ];
        if (!filteredCharacters.length) {
            story[index].other_characters = null;
            continue;
        }
        for (const character of filteredCharacters) {
            if (!characterDescriptionMap[character]) {
                const descriptionPrompt = `Be creative and use simple verbs and nouns to describe what ${character} looks like.
         Include their gender as "a man", or "a woman".  
         Do not describe ${hero}.
         Respond in JSON with the following format: {
           "description": the description as a string
         }
        `;
                const characterDescription = await (0, apis_1.getOllamaString)(descriptionPrompt, model, currentContext);
                const characterDescriptionJson = JSON.parse(characterDescription.response);
                currentContext = characterDescription.context;
                characterDescriptionMap[character] =
                    (_c = characterDescriptionJson === null || characterDescriptionJson === void 0 ? void 0 : characterDescriptionJson.description) === null || _c === void 0 ? void 0 : _c.toString();
            }
        }
        const descriptionPrompt = `Be creative and use simple verbs and nouns to describe how ${filteredCharacters[0]} would react to this paragraph: "${paragraph}". 
     Do not describe ${hero}.
     Respond in JSON with the following format: {
       "description": the description as a string
     }
    `;
        //const descriptionPrompt = "say poop";
        const description = await (0, apis_1.getOllamaString)(descriptionPrompt, model, currentContext);
        const descriptionJson = JSON.parse(description.response);
        currentContext = description.context;
        story[index].other_characters = descriptionJson.description.toString();
        // FIXME: Better naming here - this should be more like the physical description I think
        const heroDescriptionPrompt = `Be creative and use simple verbs and nouns to describe how ${hero} would react to this paragraph: "${paragraph}" 
      Ensure we respect their description: ${physicalDescription}. 
      Do not describe ${filteredCharacters[0]}.
      Respond in JSON with the following format: {
        "description": the description as a string
      }`;
        const heroDescription = await (0, apis_1.getOllamaString)(heroDescriptionPrompt, model, currentContext);
        currentContext = heroDescription.context;
        const heroDescriptionJson = JSON.parse(heroDescription.response);
        story[index].paragraph_tags = heroDescriptionJson.description.toString();
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
        for (const [imageIndex, image] of images) {
            await (0, promises_1.writeFile)(`./stories/${directoryPath}/${index}-${imageIndex}.png`, Buffer.from(image, "base64"));
            if (!imageBlobs[index])
                imageBlobs[index] = [Buffer.from(image, "base64")];
            else
                imageBlobs[index].push(Buffer.from(image, "base64"));
        }
    }
    await Promise.all([
        (0, promises_1.writeFile)(`./stories/${directoryPath}/index.html`, (0, templateGenerator_1.getTemplate)(story, 
        // Send through the previews before we edit.
        imageBlobs.map((x) => x[0]))),
        (0, promises_1.writeFile)(`./stories/${directoryPath}/story.json`, JSON.stringify(story)),
        (0, promises_1.copyFile)("./template/HobbyHorseNF.otf", `./stories/${directoryPath}/HobbyHorseNF.otf`),
    ]);
    webUi.stopProcess();
    return 0;
}
makeStory();
//# sourceMappingURL=script.js.map