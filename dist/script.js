"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const commander_1 = require("commander");
commander_1.program
    .option("-m, --model <model>", "ollama model to use", "mistral")
    .option("-g, --genre <title>", "genre of the story", "children's story")
    .option("-p, --storyPlot <prompt>", "suggested plot for the hero of the story", "")
    .option("-h, --hero <name>", "description of the protagonist", "a child named Gavin")
    .option("-pg, --pages <page>", "number of pages to generate", "5")
    .option("-l, --lora <lora>", "lora to use", "el gavin")
    .option("-lw, --loraWeight", "weight of the lora", "1")
    .option("-pr, --prompt <prompt>", `additional details to provide to the prompt [ex: "(portrait), (toddler), (boy), ((frame from a Studio Ghibli movie))"]`, "(portrait), (extra detailed)")
    .option("-s, --sampler <sampler>", "sampler to use", "DPM++ 2M Karras")
    .option("-st, --steps <steps>", "number of steps to use in rendering", "50")
    .option("-x, --width <width>", "width of the image", "512")
    .option("-y, --height <height>", "height of the image", "768")
    .parse();
async function makeStory() {
    const opts = commander_1.program.opts();
    console.log("Options: ", opts);
    const { model, genre, storyPlot, hero, pages, lora, loraWeight, prompt, sampler, steps, width, height, } = commander_1.program.opts();
    const fullPrompt = `Make me a ${genre} about ${hero} ${storyPlot ? `where ${storyPlot} ` : ""}in ${pages} separate parts. Respond in JSON by placing an array in a key called story that holds each part. Each array element contains a paragraph key, which has the paragraph, and a description key, which is a visual description of what is happening in the paragraph. The descriptions should describe in plain language what is visible in that part of the story.`;
    console.log("Prompt being given to ollama: ", fullPrompt);
    const oolamaResp = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({
            model,
            prompt: fullPrompt,
            stream: false,
            format: "json",
            keep_alive: "5s",
        }),
    });
    const oolamaJson = await oolamaResp.json();
    if (oolamaJson.error) {
        console.log("Error from Oolama:", oolamaJson.error);
        throw "Error from Oolama.";
    }
    const { story, } = JSON.parse(oolamaJson.response);
    console.log("Ollama response:", story);
    const directoryPath = Math.floor(Date.now() / 1000).toString();
    await (0, promises_1.mkdir)(`./stories/${directoryPath}`, { recursive: true });
    for (const [index, paragraph] of story.entries()) {
        const sdTxt2ImgResp = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: `<lora:${lora}:${loraWeight}> ${paragraph.description}${prompt ? ` ${prompt}` : ""}`,
                negative_prompt: "lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature, split frame, multiple frame, split panel, multi panel, cropped, diptych, triptych",
                seed: -1,
                sampler_name: sampler,
                batch_size: 1,
                steps: steps.toString(),
                cfg_scale: 10,
                width: Number(width),
                height: Number(height),
                restore_faces: true,
                tiling: false,
                refiner_switch_at: 0.8,
                disable_extra_networks: false,
                send_images: true,
                save_images: true,
                // styles: [],
                // subseed: -1,
                // subseed_strength: 0,
                // seed_resize_from_h: -1,
                // seed_resize_from_w: -1,
                // n_iter: 5, // FIXME: Is this weird?
                // do_not_save_samples: false,
                // do_not_save_grid: false,
                // eta: 0,
                // denoising_strength: 0,
                // s_min_uncond: 0,
                // s_churn: 0,
                // s_tmax: 0,
                // s_tmin: 0,
                // s_noise: 0,
                // override_settings: {},
                // override_settings_restore_afterwards: true,
                // refiner_checkpoint: "string",
                // comments: {},
                // enable_hr: false,
                // firstphase_width: 0,
                // firstphase_height: 0,
                // hr_scale: 2,
                // hr_upscaler: "string",
                // hr_second_pass_steps: 0,
                // hr_resize_x: 0,
                // hr_resize_y: 0,
                // hr_checkpoint_name: "string",
                // hr_sampler_name: "string",
                // hr_prompt: "",
                // hr_negative_prompt: "",
                // sampler_index: "DPM++ 2M Karras",
                // script_name: "string",
                // script_args: [],
                // alwayson_scripts: {},
            }),
        });
        if (sdTxt2ImgResp.status !== 200) {
            console.log("Unexpected status code: ", sdTxt2ImgResp, await sdTxt2ImgResp.json());
            throw "Unexpected status code from stable diffusion API.";
        }
        const image = await sdTxt2ImgResp.blob();
        await (0, promises_1.writeFile)(`./stories/${directoryPath}/${index}.png`, Buffer.from(JSON.parse(await image.text()).images[0], "base64"));
    }
    await (0, promises_1.writeFile)(`./stories/${directoryPath}/index.html`, `
  <html>
    <head>
      <title>Stories</title>
    </head>
    <body>
      <table>
        ${story
        .map(({ paragraph }, index) => `<tr><td><img src="./${index}.png" /></td><td><h1>${paragraph}</h1></td></tr>`)
        .join("")}
      </table>
    </body>
  <html>  
  `);
    return 0;
}
makeStory();
//# sourceMappingURL=script.js.map