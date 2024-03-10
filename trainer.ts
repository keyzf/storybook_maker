// Run the caption generator on the files in the training directory.
// ../OneTrainer/venv/bin/python3 ../OneTrainer/scripts/generate_captions.py --sample_dir ${path} --model BLIP --initial_caption "easyphoto, 1person, portrait"
//
import { program } from "commander";

const util = require("node:util");
const fs = require("node:fs/promises");
import { spawn, exec } from "child_process";

const spawnAsync = util.promisify(spawn);
const execAsync = util.promisify(exec);

program
  .option("-p, --path <path>", "path to the training images")
  .option("-n, --name <name>", "name for the new model")
  .parse();

const {
  path,
  name: modelName,
}: {
  path: string;
  name: string;
} = program.opts();

const getTrainConfig = (name, path) => ({
  __version: 2,
  training_method: "LORA",
  model_type: "STABLE_DIFFUSION_15",
  debug_mode: false,
  debug_dir: "debug",
  workspace_dir: "workspace/run",
  cache_dir: "workspace-cache/run",
  tensorboard: false,
  tensorboard_expose: false,
  continue_last_backup: false,
  include_train_config: "NONE",
  base_model_name:
    "/home/kyle/Development/stable_diffusion/stable-diffusion-webui/models/Stable-diffusion/v1-5-pruned.ckpt",
  weight_dtype: "FLOAT_16",
  output_dtype: "FLOAT_32",
  output_model_format: "SAFETENSORS",
  output_model_destination: `models/${name}.safetensors`,
  gradient_checkpointing: true,
  // concept_file_name: "training_concepts/concepts.json",
  concepts: [
    {
      __version: 0,
      image: {
        __version: 0,
        enable_crop_jitter: true,
        enable_random_flip: true,
        enable_fixed_flip: false,
        enable_random_rotate: false,
        enable_fixed_rotate: false,
        random_rotate_max_angle: 0.0,
        enable_random_brightness: false,
        enable_fixed_brightness: false,
        random_brightness_max_strength: 0.0,
        enable_random_contrast: false,
        enable_fixed_contrast: false,
        random_contrast_max_strength: 0.0,
        enable_random_saturation: false,
        enable_fixed_saturation: false,
        random_saturation_max_strength: 0.0,
        enable_random_hue: false,
        enable_fixed_hue: false,
        random_hue_max_strength: 0.0,
        enable_resolution_override: false,
        resolution_override: "512",
      },
      text: {
        __version: 0,
        prompt_source: "sample",
        prompt_path: "",
        enable_tag_shuffling: false,
        tag_delimiter: ",",
        keep_tags_count: 1,
      },
      name,
      path,
      seed: 23340967,
      enabled: true,
      include_subdirectories: false,
      image_variations: 10,
      text_variations: 1,
      repeats: 5.0,
      loss_weight: 1.0,
    },
  ],
  circular_mask_generation: false,
  random_rotate_and_crop: false,
  aspect_ratio_bucketing: true,
  latent_caching: true,
  clear_cache_before_training: true,
  learning_rate_scheduler: "CONSTANT",
  learning_rate: 0.0003,
  learning_rate_warmup_steps: 200,
  learning_rate_cycles: 1,
  epochs: 75,
  batch_size: 5,
  gradient_accumulation_steps: 1,
  ema: "OFF",
  ema_decay: 0.999,
  ema_update_step_interval: 5,
  train_device: "cuda",
  temp_device: "cpu",
  train_dtype: "FLOAT_16",
  fallback_train_dtype: "BFLOAT_16",
  only_cache: false,
  resolution: "512",
  attention_mechanism: "XFORMERS",
  align_prop: false,
  align_prop_probability: 0.1,
  align_prop_loss: "AESTHETIC",
  align_prop_weight: 0.01,
  align_prop_steps: 20,
  align_prop_truncate_steps: 0.5,
  align_prop_cfg_scale: 7.0,
  mse_strength: 1.0,
  mae_strength: 0.0,
  vb_loss_strength: 1.0,
  min_snr_gamma: 0.0,
  dropout_probability: 0.0,
  loss_scaler: "NONE",
  learning_rate_scaler: "NONE",
  offset_noise_weight: 0.0,
  perturbation_noise_weight: 0.0,
  rescale_noise_scheduler_to_zero_terminal_snr: false,
  force_v_prediction: false,
  force_epsilon_prediction: false,
  min_noising_strength: 0.0,
  max_noising_strength: 1.0,
  noising_weight: 0.0,
  noising_bias: 0.5,
  unet: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: 0,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  prior: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: 0,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  text_encoder: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: 30,
    stop_training_after_unit: "EPOCH",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  text_encoder_layer_skip: 0,
  text_encoder_2: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: 30,
    stop_training_after_unit: "EPOCH",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  text_encoder_2_layer_skip: 0,
  vae: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: null,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "FLOAT_32",
  },
  effnet_encoder: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: null,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  decoder: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: null,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  decoder_text_encoder: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: null,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  decoder_vqgan: {
    __version: 0,
    model_name: "",
    train: true,
    stop_training_after: null,
    stop_training_after_unit: "NEVER",
    learning_rate: null,
    weight_dtype: "NONE",
  },
  masked_training: true,
  unmasked_probability: 0.1,
  unmasked_weight: 0.1,
  normalize_masked_area_loss: false,
  embeddings: [
    {
      __version: 0,
      model_name: "",
      train: true,
      stop_training_after: null,
      stop_training_after_unit: "NEVER",
      token_count: 1,
      initial_embedding_text: "*",
      weight_dtype: "FLOAT_32",
    },
  ],
  embedding_weight_dtype: "FLOAT_32",
  lora_model_name: "",
  lora_rank: 16,
  lora_alpha: 1.0,
  lora_weight_dtype: "FLOAT_32",
  optimizer: {
    __version: 0,
    optimizer: "ADAMW",
    adam_w_mode: false,
    alpha: null,
    amsgrad: false,
    beta1: 0.9,
    beta2: 0.999,
    beta3: null,
    bias_correction: false,
    block_wise: false,
    capturable: false,
    centered: false,
    clip_threshold: null,
    d0: null,
    d_coef: null,
    dampening: null,
    decay_rate: null,
    decouple: false,
    differentiable: false,
    eps: 1e-8,
    eps2: null,
    foreach: false,
    fsdp_in_use: false,
    fused: true,
    growth_rate: null,
    initial_accumulator_value: null,
    is_paged: false,
    log_every: null,
    lr_decay: null,
    max_unorm: null,
    maximize: false,
    min_8bit_size: null,
    momentum: null,
    nesterov: false,
    no_prox: false,
    optim_bits: null,
    percentile_clipping: null,
    relative_step: false,
    safeguard_warmup: false,
    scale_parameter: false,
    stochastic_rounding: false,
    use_bias_correction: false,
    use_triton: false,
    warmup_init: false,
    weight_decay: 0.01,
  },
  optimizer_defaults: {},
  sample_definition_file_name: "training_samples/samples.json",
  samples: [
    {
      __version: 0,
      enabled: true,
      prompt: "easyphoto, in a business suit, looking at the camera",
      negative_prompt: "",
      height: 512,
      width: 512,
      seed: 42,
      random_seed: false,
      diffusion_steps: 20,
      cfg_scale: 7.0,
      noise_scheduler: "DDIM",
    },
  ],
  sample_after: 5,
  sample_after_unit: "MINUTE",
  sample_image_format: "JPG",
  samples_to_tensorboard: false,
  non_ema_sampling: true,
  backup_after: 10,
  backup_after_unit: "MINUTE",
  rolling_backup: false,
  rolling_backup_count: 3,
  backup_before_save: true,
  save_after: 0,
  save_after_unit: "NEVER",
});

export async function runTrainer() {
  console.log("Generating captions for training images...");
  const captionResult = execAsync(
    `./venv/bin/python3 ./scripts/generate_captions.py --sample-dir ${path} --model BLIP --initial-caption "easyphoto, 1person, portrait"`,
    { cwd: "/home/kyle/Development/OneTrainer" }
  );

  captionResult.child.stdout.on("data", (output) => console.log(output));
  await captionResult;

  if (captionResult.stderr) {
    console.log(captionResult.stderr);
    throw "Error generating captions.";
  }

  console.log("Generating masks for training images...");
  const maskResult = execAsync(
    `./venv/bin/python3 ./scripts/generate_masks.py --model REMBG_HUMAN --sample-dir ${path} --add-prompt "easyphoto, 1person, portrait"`,
    { cwd: "/home/kyle/Development/OneTrainer" }
  );

  maskResult.child.stdout.on("data", (output) => console.log(output));
  await maskResult;

  if (maskResult.stderr) {
    console.log(maskResult.stderr);
    throw "Error generating masks.";
  }

  console.log("Writing config...");
  await fs.writeFile(
    "/home/kyle/Development/OneTrainer/current_config.json",
    JSON.stringify(getTrainConfig(modelName, path))
  );

  console.log("Starting training...");
  const trainResult = execAsync(
    `./venv/bin/python3 ./scripts/train.py --config-path /home/kyle/Development/OneTrainer/current_config.json`,
    { cwd: "/home/kyle/Development/OneTrainer" }
  );

  trainResult.child.stdout.on("data", (output) => console.log(output));
  await trainResult;

  if (trainResult.stderr) {
    console.log(trainResult.stderr);
    throw "Error training.";
  }

  // TODO: Copy the completed lora model to the models directory
}

runTrainer();
