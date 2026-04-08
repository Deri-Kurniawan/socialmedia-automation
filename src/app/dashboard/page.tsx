"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Play, Eye, EyeOff, Lock, AlertCircle, Clock } from "lucide-react";
import VideoUploadForm from "@/components/video-upload-form";

interface UploadHistoryItem {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  tags: string[];
  privacyStatus: string;
  categoryName: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  status: string;
  fileSize: number | null;
  createdAt: string;
  errorMessage: string | null;
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Fetch upload history - must be before any early returns
  useEffect(() => {
    if (!session) return;
    
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
  }, [session]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
      </div>
    );
  }

  // Note: Auth check is handled by layout.tsx server-side
  // This check is just for TypeScript - session should always exist here
  if (!session) {
    return null;
  }

  const user = session.user;

  const handleUploadSuccess = () => {
    setUploadCount((prev) => prev + 1);
    // Refresh history after successful upload
    setTimeout(() => {
      fetch("/api/video/history")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.uploads) {
            setUploadHistory(data.uploads);
            setUploadCount(data.uploads.length);
          }
        })
        .catch(console.error);
    }, 1000);
  };

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
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage your social media automation
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.image || ""} alt={user.name} />
              <AvatarFallback>
                {user.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {user.name}
              </p>
              <p className="text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-4"
          >
            Sign Out
          </Button>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Accounts</CardTitle>
            <CardDescription>
              Social media accounts linked to your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              1
            </p>
            <p className="text-sm text-zinc-500 mt-1">Google/YouTube</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Published Videos</CardTitle>
            <CardDescription>
              Videos uploaded this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {uploadCount}
            </p>
            <p className="text-sm text-zinc-500 mt-1">This session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Generations</CardTitle>
            <CardDescription>
              Metadata generated by AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              ∞
            </p>
            <p className="text-sm text-zinc-500 mt-1">Unlimited with Fireworks</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="upload">Upload Video</TabsTrigger>
          <TabsTrigger value="youtube">YouTube Status</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="max-w-3xl">
            <VideoUploadForm onSuccess={handleUploadSuccess} />
          </div>
        </TabsContent>

        <TabsContent value="youtube">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Integration</CardTitle>
              <CardDescription>
                Your Google account is connected with full YouTube permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg mb-6">
                <div className="h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    YouTube Channel Access
                  </p>
                  <p className="text-sm text-zinc-500">
                    Full permissions including upload, analytics, and content management
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-green-600 font-medium">
                    Connected
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                  Granted Permissions:
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    Upload videos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    Manage videos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    View analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    Channel memberships
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    Content partner program
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    Monetization data
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                View your recent video uploads ({uploadHistory.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
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
                        {/* Thumbnail */}
                        <div className="flex-shrink-0">
                          {upload.thumbnailUrl && upload.status === "completed" ? (
                            <img
                              src={upload.thumbnailUrl}
                              alt={upload.title}
                              className="w-32 h-18 object-cover rounded-md bg-zinc-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68' fill='%23e4e4e7'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717b' font-size='10'%3ENo Preview%3C/text%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="w-32 h-18 bg-zinc-200 dark:bg-zinc-800 rounded-md flex items-center justify-center">
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
                            {upload.status === "completed" && upload.videoUrl && (
                              <a
                                href={upload.videoUrl}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
