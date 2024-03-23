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

function getSharedStableDiffusionSettings({
  prompt,
  steps,
  width,
  height,
  useRegions,
  lora,
  physicalDescription,
  storyPage,
  sampler,
}) {
  const basePrompt = useRegions
    ? prompt
    : `<lora:${lora}:1>${physicalDescription}, ${storyPage.hero_description}, ${storyPage.background}, ${prompt}`;
  console.log("### Base prompt", basePrompt);

  return {
    prompt: basePrompt,
    negative_prompt:
      "lowres, text, error, cropped, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, bad proportions, extra limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature, split frame, multiple frame, split panel, multi panel",
    seed: -1,
    steps,
    cfg_scale: 16,
    width: Number(width),
    height: Number(height),
    restore_faces: true,
    disable_extra_networks: false,
    sampler_name: sampler,
    send_images: true,
    save_images: true,
    denoisingStrength: 0.5,
  };
}

export async function getStableDiffusionImages({
  prompt,
  steps,
  width,
  height,
  storyPage,
  lora,
  physicalDescription,
  sampler,
  useRegions,
  urlBase = "127.0.0.1:7860",
}: {
  prompt: string;
  steps: string;
  width: string;
  height: string;
  storyPage: StoryPage;
  lora: string;
  physicalDescription: string;
  sampler: string;
  useRegions: boolean;
  urlBase?: string;
}): Promise<string[]> {
  const sharedSettings = getSharedStableDiffusionSettings({
    prompt,
    steps,
    width,
    height,
    lora,
    physicalDescription,
    sampler,
    storyPage,
    useRegions,
  });
  console.log("### Base Prompt: ", prompt);

  const sdTxt2ImgResp = await fetch(`http://${urlBase}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...sharedSettings,
      batch_size: 5,
      alwayson_scripts: {
        ...(useRegions
          ? getMultiDiffusionScriptArgs({
              width: Number(width),
              height: Number(height),
              storyPage,
              lora,
              physicalDescription,
              useRegions,
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

  return txt2ImgJson.images;
}

export async function getUpscaledStableDiffusionImages({
  images,
  storyPages,
  width,
  height,
  prompt,
  steps,
  lora,
  physicalDescription,
  sampler,
  urlBase = "127.0.0.1:7860",
}: {
  images: string[];
  storyPages: StoryPage[];
  width: number;
  height: number;
  prompt: string;
  steps: string;
  lora: string;
  physicalDescription: string;
  sampler: string;
  urlBase?: string;
}) {
  const resizedImages: string[] = [];

  for (const [index, image] of images.entries()) {
    const useRegions = !!storyPages[index].other_characters?.length;

    const sharedSettings = getSharedStableDiffusionSettings({
      prompt,
      steps,
      width: String(width),
      height: String(height),
      lora,
      physicalDescription,
      sampler,
      storyPage: storyPages[index],
      useRegions,
    });

    const sdImg2ImgResp = await fetch(`http://${urlBase}/sdapi/v1/img2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sharedSettings,
        batch_size: 1,
        denoising_strength: sharedSettings.denoisingStrength,
        init_images: [image],
        alwayson_scripts: {
          ...getMultiDiffusionScriptArgs({
            width: Number(width),
            height: Number(height),
            storyPage: storyPages[index],
            lora,
            physicalDescription,
            useRegions,
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
