import { getMultiDiffusionScriptArgs } from "./multiDiffusion";
import { StoryPage } from "./types";

export async function getStoryPages(
  prompt: string,
  model: string
): Promise<StoryPage[]> {
  const oolamaResp = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: prompt,
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
    story: Array<StoryPage>;
  } = JSON.parse(oolamaJson.response);
  console.log("Ollama response:", story);

  return story;
}

export async function getStableDiffusionImageBlob({
  prompt,
  modelStableDiffusion,
  sampler,
  steps,
  width,
  height,
  storyPage,
  lora,
  loraWeight,
  hero,
  heroDescription,
  urlBase = "127.0.0.1:7860",
}: {
  prompt: string;
  modelStableDiffusion: string;
  sampler: string;
  steps: string;
  width: string;
  height: string;
  storyPage: StoryPage;
  lora: string;
  loraWeight: string;
  hero: string;
  heroDescription: string;
  urlBase?: string;
}): Promise<Blob> {
  const sdTxt2ImgResp = await fetch(`http://${urlBase}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt:
        "multiple people, lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature, split frame, multiple frame, split panel, multi panel, cropped, diptych, triptych, nude, naked",
      seed: -1,
      // Specifying the model via the api appears to break batching.
      // model: modelStableDiffusion,
      sampler_name: sampler,
      batch_size: 3,
      steps: steps.toString(),
      cfg_scale: 15,
      width: Number(width),
      height: Number(height),
      restore_faces: true,
      refiner_switch_at: 0.8,
      disable_extra_networks: false,
      send_images: true,
      save_images: true,
      alwayson_scripts: {
        ...getMultiDiffusionScriptArgs({
          width: Number(width),
          height: Number(height),
          storyPage,
          lora,
          loraWeight,
          hero,
          heroDescription,
        }),
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
  });

  if (sdTxt2ImgResp.status !== 200) {
    console.log(
      "Unexpected status code: ",
      sdTxt2ImgResp,
      await sdTxt2ImgResp.json()
    );
    throw "Unexpected status code from stable diffusion API.";
  }

  return sdTxt2ImgResp.blob();
}
