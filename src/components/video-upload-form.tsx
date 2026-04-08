"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { X, Upload, Sparkles, Loader2, FileVideo, Brain, CheckCircle, AlertCircle, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fireworksModels, defaultVideoAnalysisModel } from "@/lib/ai/fireworks-models";
import { useAppForm } from "@/hooks/form-hook";
import {
  Form,
  Field,
  FieldLabel,
  FieldControl,
  FieldDescription,
  FieldError,
} from "@/components/ui/form";

// YouTube Category ID to Name mapping
const YOUTUBE_CATEGORIES: Record<string, string> = {
  "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music", "15": "Pets & Animals",
  "17": "Sports", "19": "Travel & Events", "20": "Gaming", "22": "People & Blogs",
  "23": "Comedy", "24": "Entertainment", "25": "News & Politics", "26": "Howto & Style",
  "27": "Education", "28": "Science & Technology",
};

// Maximum total characters for all tags combined (like YouTube Studio)
const MAX_TAGS_TOTAL_LENGTH = 500;

interface FormData {
  title: string;
  description?: string;
  tags: string[];
  privacyStatus: "public" | "private" | "unlisted";
  categoryId: string;
  aiModel: string;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  tags: z.array(z.string()),
  privacyStatus: z.enum(["public", "private", "unlisted"]),
  categoryId: z.string(),
  aiModel: z.string(),
});

interface VideoUploadFormProps {
  onSuccess?: () => void;
  selectedIntegrationId?: string | null;
}

function AnimatedProgressBar({ progress, status }: { progress: number; status: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-medium"
          >
            {status}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm font-bold">
          {progress}%
        </span>
      </div>
      <div className="h-3 w-full bg-zinc-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-linear-to-r from-blue-500 to-green-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
    </div>
  );
}

function AnimatedStatus({ status, isError }: { status: string; isError?: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.15 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isError ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"
          }`}
      >
        {isError ? <AlertCircle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{status}</span>
      </motion.div>
    </AnimatePresence>
  );
}

export default function VideoUploadForm({ onSuccess, selectedIntegrationId }: VideoUploadFormProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedFrame, setExtractedFrame] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [copied, setCopied] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const form = useAppForm({
    defaultValues: {
      title: "",
      description: "",
      tags: [],
      privacyStatus: "public",
      categoryId: "24",
      aiModel: defaultVideoAnalysisModel,
    } as FormData,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await handleUpload(value);
    },
  });

  // Calculate total tag characters
  const totalTagChars = tags.join("").length;
  const remainingTagChars = MAX_TAGS_TOTAL_LENGTH - totalTagChars;
  const isNearLimit = remainingTagChars < 50;
  const isAtLimit = remainingTagChars <= 0;

  const mapCategoryToId = (suggestion: string): string => {
    const map: Record<string, string> = {
      "Film & Animation": "1", "Autos & Vehicles": "2", "Music": "10", "Pets & Animals": "15",
      "Sports": "17", "Travel & Events": "19", "Gaming": "20", "People & Blogs": "22",
      "Comedy": "23", "Entertainment": "24", "News & Politics": "25", "Howto & Style": "26",
      "Education": "27", "Science & Technology": "28",
    };
    if (map[suggestion]) return map[suggestion];
    const lower = suggestion.toLowerCase();
    for (const [name, id] of Object.entries(map)) {
      if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) return id;
    }
    return "22";
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith("video/")) {
    setVideoFile(file);
    setUploadError(null);
    }
  }, []);

  // Setup SSE for progress tracking (works for both analyze and upload)
  const setupProgressSSE = (id: string, isAnalyze: boolean = false) => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const endpoint = `/api/video/upload-progress?id=${id}`;
    const eventSource = new EventSource(endpoint);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) setUploadProgress(data.progress);
        if (data.status) setUploadStatus(data.status);
        if (data.error) {
          setUploadError(data.error);
          if (isAnalyze) setIsAnalyzing(false); else setIsUploading(false);
          eventSource.close();
        }
        if (data.completed) eventSource.close();
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };
  };

  const handleAnalyze = async () => {
    if (!videoFile) return alert("Please select a video file");

    const analyzeId = `analyze_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setIsAnalyzing(true);
    setUploadProgress(0);
    setUploadStatus("Initializing analysis...");
    setUploadError(null);

    setupProgressSSE(analyzeId, true);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("model", form.getFieldValue("aiModel"));

      const response = await fetch("/api/video/analyze", {
        method: "POST",
        headers: { "X-Analyze-Id": analyzeId },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to analyze");

      const data = await response.json();
      if (data.analysis) {
        form.setFieldValue("title", data.analysis.title);
        form.setFieldValue("description", data.analysis.description);
        setTags(data.analysis.tags || []);
        form.setFieldValue("tags", data.analysis.tags || []);
        if (data.analysis.categorySuggestion) form.setFieldValue("categoryId", mapCategoryToId(data.analysis.categorySuggestion));
        if (data.frameUrl) setExtractedFrame(data.frameUrl);
      }
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setIsAnalyzing(false);
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    }
  };

  // Tag management with TOTAL character limit
  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/^#/, ""); // Remove leading # if present
    if (!trimmed || tags.includes(trimmed)) return;

    // Check if adding this tag would exceed total limit
    const newTotalLength = totalTagChars + trimmed.length;
    if (newTotalLength > MAX_TAGS_TOTAL_LENGTH) {
      alert(`Cannot add tag. Total tag characters would be ${newTotalLength}, exceeding the limit of ${MAX_TAGS_TOTAL_LENGTH}.`);
      return;
    }

    const newTags = [...tags, trimmed];
    setTags(newTags);
    form.setFieldValue("tags", newTags);
  };

  // Batch add multiple tags - more efficient for paste operations
  const addTagsBatch = (newTags: string[]) => {
    const validTags: string[] = [];
    let currentLength = totalTagChars;

    for (const tag of newTags) {
      const trimmed = tag.trim().replace(/^#/, "");
      if (!trimmed || tags.includes(trimmed) || validTags.includes(trimmed)) continue;

      if (currentLength + trimmed.length > MAX_TAGS_TOTAL_LENGTH) {
        break; // Stop if we'd exceed limit
      }

      validTags.push(trimmed);
      currentLength += trimmed.length;
    }

    if (validTags.length > 0) {
      const combinedTags = [...tags, ...validTags];
      setTags(combinedTags);
      form.setFieldValue("tags", combinedTags);
    }

    return validTags.length;
  };

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
    form.setFieldValue("tags", newTags);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tagsToAdd = tagInput
        .split(",")
        .map(t => t.trim().replace(/^#/, ""))
        .filter(t => t);

      addTagsBatch(tagsToAdd);
      setTagInput("");
    }
    if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleTagPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");

    // Split by comma and process all at once
    const pastedTags = pastedText
      .split(",")
      .map(t => t.trim().replace(/^#/, ""))
      .filter(t => t);

    addTagsBatch(pastedTags);
    setTagInput("");
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // If value contains comma, auto-split immediately
    if (value.includes(",")) {
      const parts = value.split(",");
      const tagsToAdd = parts
        .slice(0, -1) // All parts except the last one
        .map(t => t.trim().replace(/^#/, ""))
        .filter(t => t);

      if (tagsToAdd.length > 0) {
        addTagsBatch(tagsToAdd);
      }

      // Keep the last part (after the last comma) in input
      const remaining = parts[parts.length - 1].trim();
      setTagInput(remaining);
    } else {
      setTagInput(value);
    }
  };

  const copyTags = () => {
    navigator.clipboard.writeText(tags.join(","));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (data: FormData) => {
    if (!videoFile) return alert("Please select a video file");
    if (data.title.length > 100) return alert("Title must be ≤100 chars");
    if (data.description && data.description.length > 5000) return alert("Description must be ≤5000 chars");
    if (totalTagChars > MAX_TAGS_TOTAL_LENGTH) return alert(`Tags must be ≤${MAX_TAGS_TOTAL_LENGTH} chars total`);

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Preparing upload...");
    setUploadError(null);

    setupProgressSSE(uploadId, false);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("title", data.title.substring(0, 100));
      formData.append("description", (data.description || "").substring(0, 5000));
      formData.append("tags", JSON.stringify(tags));
      formData.append("privacyStatus", data.privacyStatus);
      formData.append("categoryId", data.categoryId);
      if (selectedIntegrationId) {
        formData.append("integrationId", selectedIntegrationId);
      }

      const response = await fetch("/api/video/upload", {
        method: "POST",
        headers: { "X-Upload-Id": uploadId },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");

      setUploadProgress(100);
      
      // Show success toast with action button
      toast.success("Video uploaded successfully!", {
        description: result.videoUrl,
        action: {
          label: "View on YouTube",
          onClick: () => window.open(result.videoUrl, "_blank"),
        },
        duration: 5000,
      });
      
      // Reset form immediately
      form.reset();
      setVideoFile(null);
      setTags([]);
      setExtractedFrame(null);
      onSuccess?.();
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setIsUploading(false);
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    }
  };

  useEffect(() => () => { if (eventSourceRef.current) eventSourceRef.current.close(); }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Video to YouTube</CardTitle>
        <CardDescription>Upload a video and let AI generate optimized metadata</CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <Form className="space-y-6">
                  {/* Video File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="video">Video File</Label>
                    <div className="border-2 border-dashed border-zinc-200 rounded-lg p-8 text-center hover:border-zinc-400 transition-colors">
                      <input type="file" id="video" accept="video/*" onChange={handleFileChange} disabled={isAnalyzing || isUploading} className="hidden" />
                      <label htmlFor="video" className="cursor-pointer flex flex-col items-center gap-2">
                        <FileVideo className="h-12 w-12 text-zinc-400" />
                        <span className="text-sm text-zinc-600">{videoFile ? videoFile.name : "Click to select a video file"}</span>
                        {videoFile && <span className="text-xs text-zinc-500">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>}
                      </label>
                    </div>
                  </div>

                  {/* AI Model Selection */}
                  {videoFile && !isUploading && (
                    <form.AppField name="aiModel">
                      {(field) => (
                        <Field>
                          <FieldLabel className="flex items-center gap-2"><Brain className="h-4 w-4" />AI Model</FieldLabel>
                          <FieldControl>
                            <Select
                              value={field.state.value || defaultVideoAnalysisModel}
                              onValueChange={(v) => field.handleChange(v || defaultVideoAnalysisModel)}
                              disabled={isAnalyzing}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-100">
                                {fireworksModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{m.name}{m.isVision && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 rounded">Vision</span>}</span>
                                      <span className="text-xs text-zinc-500">{m.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldControl>
                        </Field>
                      )}
                    </form.AppField>
                  )}

                  {/* AI Analyze Button & Progress */}
                  {videoFile && !isUploading && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Button type="button" variant="outline" onClick={handleAnalyze} disabled={isAnalyzing}>
                          {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" />AI Analyze</>}
                        </Button>
                        {isAnalyzing && <AnimatedStatus status={uploadStatus} />}
                      </div>
                      {isAnalyzing && <AnimatedProgressBar progress={uploadProgress} status={uploadStatus} />}
                    </div>
                  )}

                  {/* Extracted Frame - Fixed container prevents layout shift */}
                  <AnimatePresence>
                    {extractedFrame && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                        <Label>Extracted Frame</Label>
                        <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
                          <img 
                            src={extractedFrame} 
                            alt="Frame" 
                            className="absolute inset-0 w-full h-full object-contain"
                            loading="eager"
                            decoding="sync"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Separator />

                  {/* Title */}
                  <form.AppField name="title">
                    {(field) => {
                      const length = field.state.value?.length || 0;
                      const isWarning = length > 90;
                      const isError = length >= 100;
                      return (
                        <Field>
                          <div className="flex justify-between items-center">
                            <FieldLabel>Title *</FieldLabel>
                            <span className={`text-xs font-medium transition-colors ${isError ? "text-red-500" : isWarning ? "text-orange-500" : "text-zinc-500"}`}>
                              {length}/100
                            </span>
                          </div>
                          <FieldControl>
                            <Input
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              disabled={isUploading}
                              maxLength={100}
                              className={isError ? "border-red-300 focus-visible:ring-red-200" : ""}
                            />
                          </FieldControl>
                          <FieldError />
                        </Field>
                      );
                    }}
                  </form.AppField>

                  {/* Description */}
                  <form.AppField name="description">
                    {(field) => {
                      const length = field.state.value?.length || 0;
                      const isWarning = length > 4500;
                      const isError = length >= 5000;
                      return (
                        <Field>
                          <div className="flex justify-between items-center">
                            <FieldLabel>Description</FieldLabel>
                            <span className={`text-xs font-medium transition-colors ${isError ? "text-red-500" : isWarning ? "text-orange-500" : "text-zinc-500"}`}>
                              {length}/5000
                            </span>
                          </div>
                          <FieldControl>
                            <Textarea
                              value={field.state.value || ""}
                              onChange={(e) => field.handleChange(e.target.value)}
                              rows={6}
                              disabled={isUploading}
                              maxLength={5000}
                              className={isError ? "border-red-300 focus-visible:ring-red-200" : ""}
                            />
                          </FieldControl>
                        </Field>
                      );
                    }}
                  </form.AppField>

                  {/* Tags - Improved UI/UX */}
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <Label className="text-sm font-medium">Tags</Label>
                        <p className="text-xs text-zinc-500 mt-0.5">Add tags to help viewers find your video (max {MAX_TAGS_TOTAL_LENGTH} chars total)</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${isAtLimit ? "text-red-600 bg-red-50" : isNearLimit ? "text-orange-600 bg-orange-50" : "text-zinc-500 bg-zinc-100"}`}>
                          {totalTagChars}/{MAX_TAGS_TOTAL_LENGTH}
                        </span>
                      </div>
                    </div>

                    {/* Tag Input Container */}
                    <div
                      className={`group relative min-h-[44px] w-full rounded-lg border bg-white dark:bg-zinc-950 px-2 py-2 flex flex-wrap items-center gap-1.5 transition-all ${isAtLimit ? "border-red-400 bg-red-50/20 shadow-sm ring-1 ring-red-200" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-200"}`}
                      onClick={() => tagInputRef.current?.focus()}
                    >
                      <AnimatePresence mode="popLayout">
                        {tags.map((tag, index) => (
                          <motion.span
                            key={`${tag}-${index}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            layout
                            className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                          >
                            <span className="text-zinc-500">#</span>
                            {tag}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeTag(index); }}
                              className="ml-0.5 text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded p-0.5 transition-colors"
                              disabled={isUploading}
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>

                      <input
                        ref={tagInputRef}
                        type="text"
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagInputKeyDown}
                        onPaste={handleTagPaste}
                        disabled={isUploading || isAtLimit}
                        placeholder={isAtLimit ? "Limit reached - remove tags to add more" : tags.length === 0 ? "Type tags separated by commas or press Enter" : ""}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-zinc-400 disabled:cursor-not-allowed py-1"
                        aria-label="Add tags"
                      />
                    </div>

                    {/* Footer: Progress bar and Actions */}
                    <div className="flex items-center gap-3">
                      {/* Progress Bar */}
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full transition-colors ${isAtLimit ? "bg-red-500" : isNearLimit ? "bg-orange-500" : totalTagChars > 0 ? "bg-zinc-500" : "bg-zinc-300"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((totalTagChars / MAX_TAGS_TOTAL_LENGTH) * 100, 100)}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>

                      {/* Action Buttons */}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={copyTags}
                            className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900"
                          >
                            {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                            {copied ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setTags([]); form.setFieldValue("tags", []); }}
                            className="h-7 px-2 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Clear all
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Status Messages */}
                    <AnimatePresence>
                      {isAtLimit && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-red-600 font-medium flex items-center gap-1"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Character limit reached. Remove some tags to add more.
                        </motion.p>
                      )}
                      {isNearLimit && !isAtLimit && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-orange-600 flex items-center gap-1"
                        >
                          Only {remainingTagChars} characters remaining
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Privacy Status */}
                  <form.AppField name="privacyStatus">
                    {(field) => (
                      <Field>
                        <FieldLabel>Privacy Status</FieldLabel>
                        <FieldControl>
                          <Select
                            value={field.state.value || "public"}
                            onValueChange={(v) => field.handleChange((v || "public") as "public" | "private" | "unlisted")}
                            disabled={isUploading}
                          >
                            <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="private">Private</SelectItem>
                              <SelectItem value="unlisted">Unlisted</SelectItem>
                              <SelectItem value="public">Public</SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldControl>
                      </Field>
                    )}
                  </form.AppField>

                  {/* Category - Combobox with search */}
                  <form.AppField name="categoryId">
                    {(field) => {
                      const selectedCategory = YOUTUBE_CATEGORIES[field.state.value || "22"];
                      const categoryEntries = Object.entries(YOUTUBE_CATEGORIES); // [id, name][]

                      return (
                        <Field>
                          <div className="flex justify-between items-center">
                            <FieldLabel>Category</FieldLabel>
                            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{selectedCategory}</span>
                          </div>
                          <FieldControl>
                            <Combobox
                              value={selectedCategory}
                              onValueChange={(value) => {
                                // Find the ID for the selected name
                                const foundId = Object.entries(YOUTUBE_CATEGORIES).find(([id, name]) => name === value)?.[0];
                                if (foundId) {
                                  field.handleChange(foundId);
                                }
                              }}
                              items={categoryEntries.map(([_, name]) => name)}
                              disabled={isUploading}
                            >
                              <ComboboxInput
                                placeholder="Select a category"
                                showTrigger
                                className="w-full"
                              />
                              <ComboboxContent>
                                <ComboboxEmpty>No category found.</ComboboxEmpty>
                                <ComboboxList>
                                  {(item: string) => (
                                    <ComboboxItem key={item} value={item}>
                                      {item}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                          </FieldControl>
                        </Field>
                      );
                    }}
                  </form.AppField>

                  {/* Upload Progress */}
                  <AnimatePresence>
                    {isUploading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <AnimatedProgressBar progress={uploadProgress} status={uploadStatus} />
                        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button type="submit" disabled={!videoFile || isAnalyzing || isUploading || !canSubmit} className="w-full">
                        {isUploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload to YouTube</>}
                      </Button>
                    )}
                  </form.Subscribe>
                </Form>
              </form.AppForm>
      </CardContent>
    </Card>
  );
}
