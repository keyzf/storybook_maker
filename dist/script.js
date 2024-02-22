"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
async function makeStory() {
    // FIXME?: Need to start and stop the oolama process in order to preserve VRAM?
    const oolamaResp = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({
            model: "mistral",
            prompt: `Make me a children's story in ten separate paragraphs  about a child named Gavin. 
         Respond using JSON and put the story in a key called story and have each paragraph be a string stored in an array.
         Put the descriptions in a key called descriptions and have each description be a string stored in an array.
         The descriptions must vibrantly describe exactly what is happening and Gavin should be the focus of each description.`,
            stream: false,
            format: "json",
        }),
    });
    const oolamaJson = await oolamaResp.json();
    const parsedResponse = JSON.parse(oolamaJson.response);
    console.log("Parsed response: ", parsedResponse);
    const directoryPath = Math.floor(Date.now() / 1000).toString();
    await (0, promises_1.mkdir)(`./stories/${directoryPath}`, { recursive: true });
    for (const [index, description] of parsedResponse.descriptions.entries()) {
        const sdTxt2ImgResp = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: `<lora:el gavin:1> ${description.replace("Gavin", "A toddler named [el gavin]")}`,
                negative_prompt: "worst quality, normal quality, low quality, low res, blurry, text, watermark, logo, banner, extra digits, cropped, jpeg artifacts, signature, username, error, sketch ,duplicate, ugly, monochrome, horror, geometry, mutation, disgusting",
                seed: -1,
                sampler_name: "DPM++ 2M Karras",
                batch_size: 1,
                steps: 50,
                cfg_scale: 5,
                width: 512,
                height: 768,
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
        ${parsedResponse.story
        .map((story, index) => `<tr><td><img src="./${index}.png" /></td><td><h3>${story}</h3></td></tr>`)
        .join("")}
      </table>
    </body>
  <html>  
  `);
    return 0;
}
makeStory();
//# sourceMappingURL=script.js.map