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
    .option("-hd, --heroDescription <description>", "description of the protagonist, used in the story", "a boy toddler")
    .option("-pd, --physicalDescription <description>", "physical description of the protagonist - used in rendering", "easyphoto_face, 1person, solo")
    .option("-pg, --pages <page>", "number of pages to generate", "5")
    .option("-l, --lora <lora>", "lora to use", "gavin-15")
    .option("-lw, --loraWeight", "weight of the lora", "1")
    .option("-pr, --prompt <prompt>", `additional details to provide to the prompt - should just specify what the overall image looks like`, "masterpiece, best quality, highres, extremely clear 8k wallpaper")
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
  Each array element contains 
    a paragraph key: the paragraph, 
    a description key: an array of plaintext detailed descriptions of the other people or animals that are visible, 
    and a background key: a short description of the surroundings.`;
    console.log("Prompt being given to ollama: ", fullPrompt);
    const story = await (0, apis_1.getStoryPages)(fullPrompt, model);
    const directoryPath = Math.floor(Date.now() / 1000).toString();
    await (0, promises_1.mkdir)(`./stories/${directoryPath}`, { recursive: true });
    const webUi = new WebUiManager_1.WebUiManager();
    await webUi.startProcess();
    const imageBlobs = [];
    // Set the appropriate model.
    await (0, apis_1.setStableDiffusionModelCheckpoint)(modelStableDiffusion);
    for (const [index, storyPage] of story.entries()) {
        console.log(storyPage);
        storyPage.description = storyPage.description.filter((x) => !x.includes(hero));
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
            useRegions: storyPage.description.length > 0,
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