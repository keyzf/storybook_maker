import { getMultiDiffusionScriptArgs } from "./multiDiffusion";
import { StoryPage } from "./types";
import { readdir, readFile } from "node:fs/promises";

type sdResponse = {
  images: string[];
  parameters: {
    prompt: string;
    negative_prompt: string;
  };
};

export async function getOllamaString(
  prompt: string,
  model: string,
  context?: number[]
): Promise<{ response: string; context: number[] }> {
  console.log("### ollama request:", prompt);
  const ollamaResp = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: prompt,
      stream: false,
      format: "json",
      keep_alive: "3s",
      context,
    }),
  });

  const ollamaJson = await ollamaResp.json();
  if (ollamaJson.error) {
    console.log("Error from ollama:", ollamaJson.error);
    throw "Error from ollama.";
  }

  console.log("### ollama response", ollamaJson.response);
  return {
    response: ollamaJson.response,
    context: ollamaJson.context,
  };
}

export async function getStoryPages(
  prompt: string,
  model: string
): Promise<{ response: StoryPage[]; context: number[] }> {
  const resp = await getOllamaString(prompt, model);

  const {
    story,
  }: {
    story: Array<StoryPage>;
  } = JSON.parse(resp.response);

  return {
    response: story,
    context: resp.context,
  };
}

export async function setStableDiffusionModelCheckpoint(
  checkpoint,
  urlBase = "127.0.0.1:7860"
): Promise<void> {
  await fetch(`http://${urlBase}/sdapi/v1/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sd_model_checkpoint: checkpoint,
    }),
  });
}

export async function getStableDiffusionImages({
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
  useRegions,
  urlBase = "127.0.0.1:7860",
}: {
  prompt: string;
  sampler: string;
  steps: string;
  width: string;
  height: string;
  storyPage: StoryPage;
  lora: string;
  loraWeight: string;
  physicalDescription: string;
  characterDescriptionMap: Record<string, string>;
  useRegions: boolean;
  urlBase?: string;
}): Promise<string[]> {
  const generatedPrompt = useRegions
    ? prompt
    : `<lora:${lora}:${loraWeight}>easyphoto_face, ${physicalDescription}, ${storyPage.paragraph_tags}, ${storyPage.background}, ${prompt}`;

  console.log("### Base Prompt: ", generatedPrompt);

  const sharedSettings = {
    prompt: generatedPrompt,
    negative_prompt:
      "lowres, text, error, cropped, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, bad proportions, extra limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature, split frame, multiple frame, split panel, multi panel",
    seed: -1,
    sampler_name: sampler,
    // If regions are being used then use fewer steps.
    steps,
    cfg_scale: 16,
    width: Number(width),
    height: Number(height),
    restore_faces: true,
    disable_extra_networks: false,
    send_images: true,
    save_images: true,
  };

  const sdTxt2ImgResp = await fetch(`http://${urlBase}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...sharedSettings,
      batch_size: 1,
      ...(!useRegions
        ? {
            enable_hr: true,
            // TODO: .4 or .5?
            denoising_strength: 0.5,
            hr_second_pass_steps: 0,
            hr_scale: 2,
            hr_upscaler: "R-ESRGAN 4x+",
          }
        : {}),
      alwayson_scripts: {
        ...(useRegions
          ? getMultiDiffusionScriptArgs({
              width: Number(width),
              height: Number(height),
              storyPage,
              lora,
              loraWeight,
              physicalDescription,
              characterDescriptionMap,
            })
          : {}),
      },
    }),
  });

  if (sdTxt2ImgResp.status !== 200) {
    console.log(
      "Unexpected status code: ",
      sdTxt2ImgResp,
      await sdTxt2ImgResp.json()
    );
    throw "Unexpected status code from stable diffusion API.";
  }

  const txt2ImgJson: sdResponse = await sdTxt2ImgResp.json();

  // Return if we're not using regions, otherwise we should use img2img to resize the images.
  if (!useRegions) return txt2ImgJson.images;

  // Keep the preview images even though they will change
  const resizedImages: string[] =
    txt2ImgJson.images.length > 1 ? [txt2ImgJson.images[0]] : [];

  // TODO: Just go through the batches one by one, if denoise is low enough it doesn't take that long.
  for (const [index, image] of txt2ImgJson.images.entries()) {
    // Skip the big preview image.
    if (index === 0 && txt2ImgJson.images.length > 1) continue;

    const sdImg2ImgResp = await fetch(`http://${urlBase}/sdapi/v1/img2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sharedSettings,
        batch_size: 1,
        denoising_strength: 0.5, // Default is 0.75 - lower goes faster, higher might be better.
        init_images: [image],
        alwayson_scripts: {
          ...getMultiDiffusionScriptArgs({
            width: Number(width),
            height: Number(height),
            storyPage,
            lora,
            loraWeight,
            physicalDescription,
            characterDescriptionMap,
          }),
        },
      }),
    });

    if (sdImg2ImgResp.status !== 200) {
      console.log(
        "Unexpected status code: ",
        sdImg2ImgResp,
        await sdImg2ImgResp.json()
      );
      throw "Unexpected status code from stable diffusion API.";
    }

    const img2ImgJson: sdResponse = await sdImg2ImgResp.json();
    resizedImages.push(img2ImgJson.images[0]);
  }

  return resizedImages;
}

export async function trainStableDiffusionLora(
  id: string,
  targetDirectory: string
) {
  const b64EncodedImages = await Promise.all(
    (
      await readdir(targetDirectory)
    ).map(async (filename) =>
      (await readFile(`${targetDirectory}/${filename}`)).toString("base64")
    )
  );

  // This will timeout - need to poll logs for completion.
  fetch("http://localhost:7860/easyphoto/easyphoto_train_forward", {
    signal: new AbortController().signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: id,
      sd_model_checkpoint: "v1-5-pruned-emaonly.safetensors",
      resolution: 512,
      val_and_checkpointing_steps: 100,
      max_train_steps: 800,
      steps_per_photos: 200,
      train_batch_size: 1,
      gradient_accumulation_steps: 4,
      // I think the number of these are why we have memory problems.
      // Default is 16.
      dataloader_num_workers: 10,
      learning_rate: 1e-4,
      rank: 128,
      network_alpha: 64,
      instance_images: b64EncodedImages,
      // validation causes a mean spike in memory usage that kills everything
      validation: false,
      skin_retouching_bool: true,
    }),
  }).catch((e) => {
    console.error(
      "Error returned from training api, probably expected and thus ignored:",
      e
    );
  });
}
