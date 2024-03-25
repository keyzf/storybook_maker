export type StoryPage = {
  paragraph: string;
  heroPrompt?: string;
  supportPrompt?: string;
  background: string;
};

export type StoryMetadata = {
  characterDescriptionMap: Record<string, string>;
  lora: string;
  steps: string;
  sampler: string;
  width: string;
  height: string;
  heroTags: string;
  useRegions: boolean[];
  prompt: string;
};
