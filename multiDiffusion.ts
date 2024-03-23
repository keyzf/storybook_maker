import { StoryPage } from "./types";

export function getRegion({
  x = 0.0,
  y = 0.0,
  w = 1.0,
  h = 1.0,
  prompt,
  negativePrompt = "",
  blendMode = "Foreground",
  featherRatio = 0.2,
  seed = -1,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  prompt: string;
  negativePrompt?: string;
  blendMode?: "Background" | "Foreground";
  featherRatio?: number;
  seed?: number;
}) {
  return [
    "True", // enable - bool,
    x, // x -float,
    y, // y - float,
    w, // w - float,
    h, // h - float
    prompt, // prompt - str
    negativePrompt, // neg_prompt - str
    blendMode, // blend_mode - str
    featherRatio, // feather_ratio - float
    seed,
  ];
}

export function getMultiDiffusionScriptArgs({
  width,
  height,
  storyPage,
  lora,
  loraWeight,
  physicalDescription,
  useRegions,
}: {
  width: number;
  height: number;
  storyPage: StoryPage;
  lora: string;
  loraWeight: string;
  physicalDescription: string;
  useRegions: boolean;
}) {
  const heroPrompt = `<lora:${lora}:${loraWeight}>easyphoto_face, ${physicalDescription}, ${storyPage.paragraph_tags}`;
  console.log("### Background Prompt: ", storyPage.background);
  console.log("### Hero Prompt: ", heroPrompt);
  console.log(
    "### Other Characters Prompt: ",
    storyPage?.other_characters?.toString()
  );

  return {
    "Tiled Diffusion": {
      // TODO: type this?
      args: [
        "True", // enabled - bool
        "MultiDiffusion", // method - str ("Mixture of Diffusers" or "MultiDiffusion")
        "False", // overwrite_size - bool
        "False", // keep_input_size - bool
        Number(width), // image_width - int
        Number(height), // image_height - int

        // Don't think these do anything while Region control is active.
        96, // tile_width - int
        96, // tile_height - int
        48, // overlap - int
        8, // tile_batch_size - int
        "R-ESRGAN 4x+", // upscaler_name - str
        2, // scale_factor - float
        null, // noise_inverse - bool
        null, // noise_inverse_steps - int
        null, // noise inverse_retouch - float
        null, // noise_inverse_renoise_strength - float
        null, // noise_inverse_renoise_kernel - int
        "False", // control_tensor_cpu - bool
        useRegions ? "True" : "False", // enable_bbox_control - bool
        "False", // draw_background - bool
        "False", // causual_layers - bool

        // Background layer
        ...(useRegions
          ? [
              ...getRegion({
                prompt: storyPage.background,
                blendMode: "Background",
              }),
              // The protagonist is front and center of this.
              ...getRegion({
                x: 0.0,
                y: 0.1,
                w: 0.6,
                h: 0.9,
                featherRatio: 0.1,
                prompt: heroPrompt,
              }),
              // Other person/character
              ...getRegion({
                x: 0.4,
                y: 0.1,
                w: 0.6,
                h: 0.9,
                featherRatio: 0.3,
                prompt: storyPage.other_characters.toString(),
              }),
            ]
          : []),
      ],
      /*"Tiled VAE": {
        args: ["True", "True", "True", "True", "False", 2048, 192],
      },*/
    },
  };
}
