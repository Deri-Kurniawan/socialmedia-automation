"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  History,
  Sparkles,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Link } from "next-view-transitions";
import VideoUploadForm from "@/components/video-upload-form";
import { ChannelSelector } from "@/components/channel-selector";
import { getIntegrations } from "../integrations/actions";
import type { Integration } from "../integrations/actions";

// YouTube Icon Component
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface UploadHistoryItem {
  id: string;
  title: string;
  platform: string;
  status: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface UploadClientProps {
  initialIntegrations: Integration[];
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function UploadClient({ initialIntegrations, user }: UploadClientProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(
    initialIntegrations.filter((i) => i.isActive && i.platform === "youtube")
  );
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [recentUploads, setRecentUploads] = useState<UploadHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  // Initialize selected integration
  useEffect(() => {
    const activeIntegrations = initialIntegrations.filter(
      (i) => i.isActive && i.platform === "youtube"
    );

    if (activeIntegrations.length > 0) {
      // Auto-select default or first integration
      const defaultIntegration = activeIntegrations.find((i) => i.isDefault);
      setSelectedIntegration(defaultIntegration?.id || activeIntegrations[0].id);
    }

    // Fetch upload history
    fetchHistory();
  }, [initialIntegrations]);

  const fetchHistory = async () => {
    try {
      const historyRes = await fetch("/api/video/history");
      if (historyRes.ok) {
        const data = await historyRes.json();
        const uploads = data.uploads || [];
        setRecentUploads(uploads.slice(0, 5)); // Last 5 uploads
        setUploadCount(uploads.length);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshIntegrations = async () => {
    setIsRefreshing(true);
    try {
      const result = await getIntegrations();
      if (result.success && result.integrations) {
        const youtubeIntegrations = result.integrations.filter(
          (i) => i.isActive && i.platform === "youtube"
        );
        setIntegrations(youtubeIntegrations);

        // If current selection is not in the new list, select default or first
        const currentValid = youtubeIntegrations.find((i) => i.id === selectedIntegration);
        if (!currentValid && youtubeIntegrations.length > 0) {
          const defaultInt = youtubeIntegrations.find((i) => i.isDefault);
          setSelectedIntegration(defaultInt?.id || youtubeIntegrations[0].id);
        }

        if (youtubeIntegrations.length > initialIntegrations.length) {
          toast.success("New channel connected!");
        }
      }
    } catch (error) {
      console.error("Failed to refresh integrations:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUploadSuccess = () => {
    setUploadCount((prev) => prev + 1);
    toast.success("Video uploaded successfully!");
    // Refresh recent uploads
    fetch("/api/video/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.uploads) {
          setRecentUploads(data.uploads.slice(0, 5));
        }
      })
      .catch(console.error);
  };

  const youtubeIntegrations = integrations;
  const hasIntegrations = youtubeIntegrations.length > 0;

  if (isLoading) {
    return (
      <div className="max-w-[1440px] mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Upload Form Skeleton */}
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px] rounded-lg" />
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Upload Video
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Upload your video to YouTube with AI-powered metadata
        </p>
      </div>

      {!hasIntegrations ? (
        <Card className="border-dashed border-2 border-zinc-300">
          <CardContent className="py-12 text-center">
            <YouTubeIcon className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              No YouTube Account Connected
            </h3>
            <p className="text-zinc-500 mb-6 max-w-md mx-auto">
              You need to connect a YouTube channel before you can upload videos.
              Connect your account to get started.
            </p>
            <Link href="/dashboard/integrations">
              <Button size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Connect YouTube
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Upload Form */}
          <div className="lg:col-span-2">
            <VideoUploadForm
              onSuccess={handleUploadSuccess}
              selectedIntegrationId={selectedIntegration}
            />
          </div>

          {/* Sidebar - Sticky on desktop */}
          <div className="space-y-6 lg:sticky lg:top-24">
            {/* Channel Selection */}
            {youtubeIntegrations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <YouTubeIcon className="h-4 w-4 text-red-600" />
                      Upload Destination
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {youtubeIntegrations.length} channel{youtubeIntegrations.length !== 1 ? "s" : ""}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={refreshIntegrations}
                        disabled={isRefreshing}
                      >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {youtubeIntegrations.length === 1
                      ? "Uploading to this channel"
                      : "Select which channel to upload to"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChannelSelector
                    integrations={youtubeIntegrations}
                    selectedIntegrationId={selectedIntegration}
                    onSelect={setSelectedIntegration}
                  />

                  {/* Add Another Channel Link */}
                  <Link href="/dashboard/integrations">
                    <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Another Channel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Upload History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Upload History
                </CardTitle>
                <CardDescription>
                  {uploadCount} total upload{uploadCount !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentUploads.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500">
                    <p className="text-sm">No uploads yet</p>
                    <p className="text-xs mt-1">Your recent uploads will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        {/* Fixed aspect ratio thumbnail prevents layout shift */}
                        <div className="w-16 aspect-video bg-zinc-200 dark:bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                          {upload.thumbnailUrl ? (
                            <img
                              src={upload.thumbnailUrl}
                              alt={upload.title}
                              width={64}
                              height={36}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {upload.status === "failed" ? (
                                <AlertCircle className="h-4 w-4 text-red-400" />
                              ) : (
                                <Upload className="h-4 w-4 text-zinc-400" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {upload.title}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(upload.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={upload.status === "completed" ? "default" : "secondary"}
                          className={`text-xs ${upload.status === "completed"
                            ? "bg-green-500"
                            : upload.status === "failed"
                              ? "bg-red-500"
                              : ""
                            }`}
                        >
                          {upload.status}
                        </Badge>
                      </div>
                    ))}

                    <Link href="/dashboard/history">
                      <Button variant="ghost" className="w-full text-sm">
                        View All History
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pro Tips */}
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Pro Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    Use AI Analysis to auto-generate titles, descriptions, and tags
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    Keep titles under 60 characters for best visibility
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    Add relevant tags to improve discoverability (max 500 chars total)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    Set appropriate privacy status before uploading
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
