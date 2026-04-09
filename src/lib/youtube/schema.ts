import { z } from "zod";

export const videoMetadataSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  tags: z.array(z.string().max(500, "Each tag must be less than 500 characters"))
    .max(500, "Maximum 500 tags allowed")
    .refine(
      (tags) => !tags || tags.join(",").length <= 500,
      "Total tags character count (including commas) must not exceed 500 characters"
    )
    .optional(),
  privacyStatus: z.enum(["public", "private", "unlisted"]).default("private"),
  categoryId: z.string().default("22"), // People & Blogs
  schedulePublishAt: z.string().datetime().optional(), // ISO datetime for scheduled publishing
});

export const videoUploadSchema = videoMetadataSchema.extend({
  videoFile: z.instanceof(File, { message: "Video file is required" }),
});

export const aiAnalysisSchema = z.object({
  title: z.string().describe("A catchy, SEO-optimized title for the YouTube video (max 100 chars)"),
  description: z.string().describe("An engaging video description with timestamps and links (max 5000 chars)"),
  tags: z.array(z.string()).describe("Relevant tags for the video (max 500 characters total across all tags)"),
  categorySuggestion: z.string().describe("Suggested YouTube category for this video"),
  thumbnailDescription: z.string().describe("Description of what a good thumbnail should look like"),
});

export type VideoMetadata = z.infer<typeof videoMetadataSchema>;
export type VideoUpload = z.infer<typeof videoUploadSchema>;
export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;
