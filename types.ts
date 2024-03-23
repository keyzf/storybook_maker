export type StoryPage = {
  paragraph: string;
  hero_description: string;
  background: string;
  other_characters: string[];
};

export type StoryMetadata = {
  characterDescriptionMap: Record<string, string>;
  lora: string;
  steps: string;
  sampler: string;
  width: string;
  height: string;
  physicalDescription: string;
  useRegions: boolean[];
  prompt: string;
};
