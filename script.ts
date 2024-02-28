import { mkdir, writeFile } from "node:fs/promises";
import { program } from "commander";

program
  // FIXME: Should be able to specify both ollama and sd model.
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
  .option("-st, --steps <steps>", "number of steps to use in rendering", "45")
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
    a description key: a list of the physical objects, people, and creatures in the scene (excluding the protagonist), 
    and a background key: a short description of the surroundings.`;
  console.log("Prompt being given to ollama: ", fullPrompt);

  const oolamaResp = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      stream: false,
      format: "json",
      keep_alive: "0",
    }),
  });

  const oolamaJson = await oolamaResp.json();
  if (oolamaJson.error) {
    console.log("Error from Oolama:", oolamaJson.error);
    throw "Error from Oolama.";
  }

  const {
    story,
  }: {
    story: Array<{
      paragraph: string;
      background: string;
      description: string[];
    }>;
  } = JSON.parse(oolamaJson.response);
  console.log("Ollama response:", story);

  const directoryPath = Math.floor(Date.now() / 1000).toString();
  await mkdir(`./stories/${directoryPath}`, { recursive: true });

  for (const [index, paragraph] of story.entries()) {
    const sdTxt2ImgResp = await fetch(
      "http://127.0.0.1:7860/sdapi/v1/txt2img",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt:
            "multiple people, lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature, split frame, multiple frame, split panel, multi panel, cropped, diptych, triptych, nude, naked",
          seed: -1,
          model: modelStableDiffusion,
          sampler_name: sampler,
          batch_size: 1,
          steps: steps.toString(),
          cfg_scale: 12,
          width: Number(width),
          height: Number(height),
          restore_faces: true,
          // tiling: false,
          refiner_switch_at: 0.8,
          disable_extra_networks: false,
          send_images: true,
          save_images: true,
          alwayson_scripts: {
            "Tiled Diffusion": {
              // TODO: type this?
              args: [
                "True", // enabled - bool
                "MultiDiffusion", // method - str ("Mixture of Diffusers" or "MultiDiffusion")
                "False", // overwrite_size - bool
                "True", // keep_input_size - bool
                Number(width), // image_width - int
                Number(height), // image_height - int

                // Don't think these do anything while Region control is active.
                96, // tile_width - int
                96, // tile_height - int
                48, // overlap - int
                4, // tile_batch_size - int
                "None", // upscaler_name - str
                1, // scale_factor - float
                "False", // noise_inverse - bool
                10, // noise_inverse_steps - int
                1, // noise inverse_retouch - float
                1, // noise_inverse_renoise_strength - float
                64, // noise_inverse_renoise_kernel - int
                "False", // control_tensor_cpu - bool
                "True", // enable_bbox_control - bool
                "False", // draw_background - bool
                "False", // causual_layers - bool

                /* Layer */
                ...[
                  "True", // enable - bool,
                  0.0, // x -float,
                  0.0, // y - float,
                  1.0, // w - float,
                  1.0, // h - float
                  paragraph.background, // prompt - str
                  "", // neg_prompt - str
                  "Background", // blend_mode - str
                  0.2, // feather_ratio - float
                  -1,
                ], // seed - int

                /* Layer */
                ...[
                  "True", // enable - bool
                  0.0, // x -float,
                  0.25, // y - float,
                  0.5, // w - float,
                  0.75, // h - float
                  `<lora:${lora}:${loraWeight}>${heroDescription}`, // prompt - str
                  "", // neg_prompt - str
                  "Foreground", // blend_mode - str
                  0.2, // feather_ratio - float
                  -1,
                ], // seed - int

                /* Layer */
                ...[
                  "True", // enable - bool
                  0.5, // x -float,
                  0.0, // y - float,
                  0.5, // w - float,
                  0.75, // h - float
                  paragraph.description
                    .filter((x) => !x.includes(hero))
                    .join(","), // prompt - str
                  "", // neg_prompt - str
                  "Foreground", // blend_mode - str
                  0.2, // feather_ratio - float
                  -1, // seed - int
                ],
              ],
              "Tiled VAE": {
                args: ["True", "True", "True", "True", "False", 2048, 256],
              },
            },
            // TODO: Add some kind of configurability support to controlnet via options.
            // We currently only apply controlnet to paragraphs that mention the hero, since we're using it for clothing consistency.
            /*...(paragraph.description.includes(hero) && {
              controlnet: {
                // Docs: https://github.com/Mikubill/sd-webui-controlnet/wiki/API#integrating-sdapiv12img
                args: [
                  {
                    module: "ip-adapter_clip_sd15",
                    model: "ip-adapter_sd15 [6a3f6166]",
                    weight: 1,
                    resize_mode: 2,
                    lowvram: true,
                    pixel_perfect: true,
                    guidance_start: 0.05,
                    guidance_end: 0.15,
                    input_image: "/home/kyle/Pictures/shirt_and_jeans.png",
                  },
                ],
              },
            }),*/
          },
        }),
      }
    );

    if (sdTxt2ImgResp.status !== 200) {
      console.log(
        "Unexpected status code: ",
        sdTxt2ImgResp,
        await sdTxt2ImgResp.json()
      );
      throw "Unexpected status code from stable diffusion API.";
    }

    const image = await sdTxt2ImgResp.blob();
    await writeFile(
      `./stories/${directoryPath}/${index}.png`,
      Buffer.from(JSON.parse(await image.text()).images[0], "base64")
    );
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
              `<tr><td><img src="./${index}.png" /></td></tr><tr><td><h1>${paragraph}</h1></td></tr>`
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
