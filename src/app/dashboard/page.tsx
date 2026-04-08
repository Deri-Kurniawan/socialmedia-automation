"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Play, Eye, EyeOff, Lock, AlertCircle, Clock, Upload } from "lucide-react";
import { Link } from "next-view-transitions";
import { Skeleton } from "@/components/ui/skeleton";

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
  externalId: string;
  platform: string;
  title: string;
  description: string | null;
  tags: string[];
  privacyStatus: string;
  categoryName: string | null;
  contentUrl: string;
  thumbnailUrl: string | null;
  status: string;
  fileSize: number | null;
  createdAt: string;
  errorMessage: string | null;
}

export default function DashboardPage() {
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Fetch upload history - must be before any early returns
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/video/history");
        if (response.ok) {
          const data = await response.json();
          setUploadHistory(data.uploads || []);
          setUploadCount(data.uploads?.length || 0);
        }
      } catch (error) {
        console.error("Failed to fetch upload history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get privacy icon
  const getPrivacyIcon = (status: string) => {
    switch (status) {
      case "public":
        return <Eye className="h-3 w-3" />;
      case "unlisted":
        return <EyeOff className="h-3 w-3" />;
      case "private":
        return <Lock className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div>
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Manage your social media automation
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-stretch">
        <Link href="/dashboard/integrations" className="block h-full">
          <Card className="hover:border-zinc-300 transition-colors cursor-pointer h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Connected Accounts</CardTitle>
              <CardDescription>
                Social media accounts linked to your profile
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <div className="flex items-center gap-2">
                <div className="bg-red-600 text-white p-1.5 rounded">
                  <YouTubeIcon className="h-5 w-5" />
                </div>
                <span className="text-sm text-zinc-500">Manage integrations →</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/upload" className="block h-full">
          <Card className="hover:border-zinc-300 transition-colors cursor-pointer h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Upload Video</CardTitle>
              <CardDescription>
                Upload new videos to your connected channels
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 text-white p-1.5 rounded">
                  <Play className="h-5 w-5" />
                </div>
                <span className="text-sm text-zinc-500">Go to upload page →</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Total Uploads</CardTitle>
            <CardDescription>
              All-time videos uploaded
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {uploadCount}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              <Link href="/dashboard/history" className="text-blue-600 hover:underline">
                View history →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload History Section */}
      <div className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                View your recent video uploads ({uploadHistory.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-4 p-4 border rounded-lg">
                      {/* Skeleton matches thumbnail aspect-ratio exactly */}
                      <Skeleton className="w-32 aspect-video rounded-md flex-shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex gap-2 mt-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : uploadHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-500">
                    No uploads yet. Upload your first video using the Upload Video tab!
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {uploadHistory.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex gap-4 p-4 border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        {/* Thumbnail - Fixed aspect ratio container prevents layout shift */}
                        <div className="flex-shrink-0 w-32 aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-md overflow-hidden">
                          {upload.thumbnailUrl && upload.status === "completed" ? (
                            <img
                              src={upload.thumbnailUrl}
                              alt={upload.title}
                              width={128}
                              height={72}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='72' fill='%23e4e4e7'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717b' font-size='10'%3ENo Preview%3C/text%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {upload.status === "failed" ? (
                                <AlertCircle className="h-8 w-8 text-red-400" />
                              ) : (
                                <Play className="h-8 w-8 text-zinc-400" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                              {upload.title}
                            </h4>
                            {getStatusBadge(upload.status)}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                            <span className="flex items-center gap-1 capitalize">
                              {getPrivacyIcon(upload.privacyStatus)}
                              {upload.privacyStatus}
                            </span>
                            <span>•</span>
                            <span>{upload.categoryName || "Uncategorized"}</span>
                            <span>•</span>
                            <span>{formatFileSize(upload.fileSize)}</span>
                          </div>

                          {/* Tags */}
                          {upload.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {upload.tags.slice(0, 5).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {upload.tags.length > 5 && (
                                <span className="text-xs px-2 py-0.5 text-zinc-400">
                                  +{upload.tags.length - 5} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Error message for failed uploads */}
                          {upload.errorMessage && (
                            <p className="text-sm text-red-500 mt-2 line-clamp-2">
                              Error: {upload.errorMessage}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-zinc-400">
                              {formatDate(upload.createdAt)}
                            </span>
                            {upload.status === "completed" && upload.contentUrl && (
                              <a
                                href={upload.contentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View on YouTube
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
