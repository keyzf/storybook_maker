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
  hero,
  heroDescription,
}: {
  width: number;
  height: number;
  storyPage: StoryPage;
  lora: string;
  loraWeight: string;
  hero: string;
  heroDescription: string;
}) {
  const filteredDescription = storyPage.description.filter(
    (x) => !x.includes(hero)
  );

  return {
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
        12, // tile_batch_size - int
        "None", // upscaler_name - str
        2, // scale_factor - float
        "False", // noise_inverse - bool
        10, // noise_inverse_steps - int
        1, // noise inverse_retouch - float
        1, // noise_inverse_renoise_strength - float
        64, // noise_inverse_renoise_kernel - int
        "False", // control_tensor_cpu - bool
        "True", // enable_bbox_control - bool
        "False", // draw_background - bool
        "False", // causual_layers - bool

        // Background layer
        ...getRegion({
          prompt: storyPage.background,
          blendMode: "Background",
        }),

        // Protagonist layer
        ...(filteredDescription.length > 0
          ? [
              // The protagonist's layer - they're off to the left.
              ...getRegion({
                x: 0.0,
                y: 0.25,
                w: 0.5,
                h: 0.75,
                prompt: `<lora:${lora}:${loraWeight}>${heroDescription}`,
              }),
              // Something the protagonist is observing - off to the right
              ...getRegion({
                x: 0.5,
                y: 0.0,
                w: 0.5,
                h: 0.75,
                prompt: filteredDescription.join(","),
              }),
            ]
          : [
              // Protagonist is front and center of this.
              ...getRegion({
                x: 0.2,
                y: 0.1,
                w: 0.6,
                h: 0.8,
                prompt: `<lora:${lora}:${loraWeight}>${heroDescription}`,
              }),
            ]),
      ],
      "Tiled VAE": {
        args: ["True", "True", "True", "True", "False", 1024, 96],
      },
    },
  };
}