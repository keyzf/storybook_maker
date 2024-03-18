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
    .option("-st, --steps <steps>", "number of steps to use in rendering", "40")
    .option("-x, --width <width>", "width of the image", "512")
    .option("-y, --height <height>", "height of the image", "768")
    .parse();
async function makeStory() {
    const opts = commander_1.program.opts();
    console.log("Options: ", opts);
    const { model, modelStableDiffusion, genre, storyPlot, hero, heroDescription, physicalDescription, pages, lora, loraWeight, prompt, sampler, steps, width, height, } = commander_1.program.opts();
    // Ensure that the targeted lora exists. Saves us time if something went wrong.
    await (0, promises_1.access)(`/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Lora/${lora}.safetensors`);
    const fullPrompt = `Make me a ${genre} about ${heroDescription} named ${hero} ${storyPlot ? `where ${storyPlot} ` : ""}in ${pages} separate parts. Do not describe hair, eye, or skin colour.

  Respond in JSON by placing an array in a key called story that holds each part. 
  Each array element contains an object with the following strings:
    paragraph: the paragraph,
    paragraph_tags: descriptive comma separated tags describing ${hero},
    background: descriptive comma separated tags describing the background`;
    const story = await (0, apis_1.getStoryPages)(fullPrompt, model);
    for (const [index, { paragraph }] of Object.entries(story)) {
        const checkPrompt = `Using this paragraph, tell me whether any people or animals other than ${hero} are visible: "${paragraph}".
       Respond in JSON with the following keys:
        people: a list of the people visible,
        animals: a list of the visible animals
    `;
        const checkResp = await (0, apis_1.getOllamaString)(checkPrompt, model);
        const checkRespJson = JSON.parse(checkResp);
        const filteredCharacters = [
            ...checkRespJson.people.filter((x) => !x.toLowerCase().includes(hero.toLowerCase())),
            ...checkRespJson.animals.filter((x) => !x.toLowerCase().includes(hero.toLowerCase())),
        ];
        if (!filteredCharacters.length) {
            story[index].other_characters = null;
            continue;
        }
        const descriptionPrompt = `Be creative and make up simple verbs and nouns describing what ${filteredCharacters[0]} looks like and can be seen doing in this paragraph: "${paragraph}". 
     Do not describe ${hero}."
     Respond in JSON with the following keys:
       description: the description in simple comma separated tags
    `;
        //const descriptionPrompt = "say poop";
        const description = await (0, apis_1.getOllamaString)(descriptionPrompt, model);
        const descriptionJson = JSON.parse(description);
        story[index].other_characters = descriptionJson.description;
        // FIXME: Better naming here - this should be more like the physical description I think
        const heroDescriptionPrompt = `Be creative and make up simple verbs and nouns describing what ${hero} looks like and can be seen doing in this paragraph: "${paragraph}" 
      Ensure we respect their description: ${physicalDescription}. Do not describe ${filteredCharacters[0]}
      Respond in JSON with the following keys:
        description: the description in simple comma separated tags`;
        const heroDescription = await (0, apis_1.getOllamaString)(heroDescriptionPrompt, model);
        const heroDescriptionJson = JSON.parse(heroDescription);
        story[index].paragraph_tags = heroDescriptionJson.description;
    }
    const directoryPath = Math.floor(Date.now() / 1000).toString();
    await (0, promises_1.mkdir)(`./stories/${directoryPath}`, { recursive: true });
    const webUi = new WebUiManager_1.WebUiManager();
    await webUi.startProcess();
    const imageBlobs = [];
    // Set the appropriate model.
    await (0, apis_1.setStableDiffusionModelCheckpoint)(modelStableDiffusion);
    for (const [index, storyPage] of story.entries()) {
        console.log(storyPage);
        const imageBlob = await (0, apis_1.getStableDiffusionImageBlob)({
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
            useRegions: !!storyPage.other_characters,
            urlBase: "127.0.0.1:7860",
        });
        for (const [imageIndex, image] of Object.entries(JSON.parse(await imageBlob.text()).images)) {
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