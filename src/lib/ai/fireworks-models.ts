// Fireworks AI Models - Fetched from API
// API Endpoint: https://api.fireworks.ai/inference/v1/models

export const fireworksModels = [
  // Vision Models (supports_image_input: true) - For Video Analysis
  {
    id: "accounts/fireworks/models/kimi-k2p5",
    name: "Kimi K2.5",
    description: "Best for video analysis - 262K context, vision & chat",
    capabilities: ["vision", "chat", "tools"],
    contextLength: 262144,
    isVision: true,
  },
  {
    id: "accounts/fireworks/models/flux-kontext-max",
    name: "Flux Kontext Max",
    description: "Vision-language model for image understanding",
    capabilities: ["vision", "chat"],
    contextLength: null,
    isVision: true,
  },
  {
    id: "accounts/fireworks/models/flux-kontext-pro",
    name: "Flux Kontext Pro",
    description: "Professional vision model for content analysis",
    capabilities: ["vision", "chat"],
    contextLength: null,
    isVision: true,
  },
  // Text-Only Models (supports_image_input: false)
  {
    id: "accounts/fireworks/models/deepseek-v3p1",
    name: "DeepSeek V3.1",
    description: "Advanced reasoning - 163K context",
    capabilities: ["chat", "tools"],
    contextLength: 163840,
    isVision: false,
  },
  {
    id: "accounts/fireworks/models/deepseek-v3p2",
    name: "DeepSeek V3.2",
    description: "Latest DeepSeek with improved reasoning",
    capabilities: ["chat", "tools"],
    contextLength: 163840,
    isVision: false,
  },
  {
    id: "accounts/fireworks/models/glm-4p7",
    name: "GLM 4.7",
    description: "General language model - 202K context",
    capabilities: ["chat", "tools"],
    contextLength: 202752,
    isVision: false,
  },
  {
    id: "accounts/fireworks/models/glm-5",
    name: "GLM 5",
    description: "Latest GLM model - 202K context",
    capabilities: ["chat", "tools"],
    contextLength: 202752,
    isVision: false,
  },
  {
    id: "accounts/cogito/models/cogito-671b-v2-p1",
    name: "Cogito 671B",
    description: "Large reasoning model - 163K context",
    capabilities: ["chat"],
    contextLength: 163840,
    isVision: false,
  },
  {
    id: "accounts/fireworks/models/gpt-oss-120b",
    name: "GPT-OSS 120B",
    description: "Open source GPT - 131K context",
    capabilities: ["chat", "tools"],
    contextLength: 131072,
    isVision: false,
  },
  {
    id: "accounts/fireworks/models/mixtral-8x22b-instruct",
    name: "Mixtral 8x22B",
    description: "Sparse MoE model - 65K context",
    capabilities: ["chat", "tools"],
    contextLength: 65536,
    isVision: false,
  },
];

// Get only vision-capable models (for video frame analysis)
export const visionModels = fireworksModels.filter((model) => model.isVision);

// Get text-only models
export const textModels = fireworksModels.filter((model) => !model.isVision);

// Default model for video analysis (Kimi K2.5 - best vision model)
export const defaultVideoAnalysisModel = "accounts/fireworks/models/kimi-k2p5";

// Model categories for UI grouping
export const modelCategories = {
  vision: {
    title: "Vision Models (Recommended for Video Analysis)",
    description: "These models can analyze video frames to generate accurate metadata",
    models: visionModels,
  },
  text: {
    title: "Text-Only Models",
    description: "For text-based tasks without image analysis",
    models: textModels,
  },
};
