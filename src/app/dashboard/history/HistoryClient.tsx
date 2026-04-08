"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Play,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  Calendar,
  FileText,
  Tag,
  Trash2,
  RefreshCw,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Upload {
  id: string;
  externalId: string;
  platform: string;
  title: string;
  description: string | null;
  tags: string[];
  privacyStatus: string;
  categoryId: string | null;
  categoryName: string | null;
  contentUrl: string;
  thumbnailUrl: string | null;
  status: string;
  fileSize: number | null;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  integrationAccountId: string | null;
  channelName: string;
  channelHandle: string | null;
  metadata: {
    thumbnail?: string;
  } | null;
}

interface Integration {
  id: string;
  name: string;
  handle: string | null;
  platform: string;
  isActive: boolean;
  metadata: {
    thumbnail?: string;
  } | null;
}

interface HistoryClientProps {
  initialUploads: Upload[];
  integrations: Integration[];
  userName: string;
}

// YouTube Icon Component
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function HistoryClient({ initialUploads, integrations, userName }: HistoryClientProps) {
  const [uploads, setUploads] = useState<Upload[]>(initialUploads);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter uploads based on search and filters
  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        upload.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        upload.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        upload.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );

      // Status filter
      const matchesStatus =
        statusFilter === "all" || upload.status === statusFilter;

      // Channel filter
      const matchesChannel =
        channelFilter === "all" ||
        upload.integrationAccountId === channelFilter;

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [uploads, searchQuery, statusFilter, channelFilter]);

  // Stats
  const stats = useMemo(() => {
    const completed = uploads.filter((u) => u.status === "completed").length;
    const failed = uploads.filter((u) => u.status === "failed").length;
    const processing = uploads.filter((u) => u.status === "processing").length;
    const totalSize = uploads.reduce((acc, u) => acc + (u.fileSize || 0), 0);
    return { completed, failed, processing, totalSize };
  }, [uploads]);

  const refreshHistory = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/video/history");
      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads || []);
        toast.success("History refreshed");
      }
    } catch (error) {
      console.error("Failed to refresh history:", error);
      toast.error("Failed to refresh history");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      full: date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Group uploads by date
  const groupedUploads = useMemo(() => {
    const groups: { [key: string]: Upload[] } = {};
    filteredUploads.forEach((upload) => {
      const date = new Date(upload.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(upload);
    });
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredUploads]);

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Upload History
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              View and manage your {uploads.length} video uploads
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHistory}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-zinc-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-zinc-500">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.processing}</p>
                <p className="text-xs text-zinc-500">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
                <p className="text-xs text-zinc-500">Total Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by title, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>

            {/* Channel Filter */}
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <YouTubeIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {integrations.map((integration) => (
                  <SelectItem key={integration.id} value={integration.id}>
                    {integration.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters */}
          {(searchQuery || statusFilter !== "all" || channelFilter !== "all") && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-zinc-500">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="ml-1 hover:text-zinc-900"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="text-xs capitalize">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="ml-1 hover:text-zinc-900"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {channelFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Channel: {" "}
                  {integrations.find((i) => i.id === channelFilter)?.name}
                  <button
                    onClick={() => setChannelFilter("all")}
                    className="ml-1 hover:text-zinc-900"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setChannelFilter("all");
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload List */}
      {filteredUploads.length === 0 ? (
        <Card className="border-dashed border-2 border-zinc-300">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              No uploads found
            </h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              {uploads.length === 0
                ? "You haven't uploaded any videos yet. Go to the upload page to get started."
                : "No uploads match your current filters. Try adjusting your search or filters."}
            </p>
            {uploads.length === 0 && (
              <Link href="/dashboard/upload">
                <Button className="mt-6">
                  <Play className="h-4 w-4 mr-2" />
                  Upload Your First Video
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedUploads.map(([date, dateUploads]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-600">
                  {new Date(date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year:
                      new Date(date).getFullYear() !== new Date().getFullYear()
                        ? "numeric"
                        : undefined,
                  })}
                </h3>
                <div className="flex-1 border-t border-zinc-200" />
                <Badge variant="secondary" className="text-xs">
                  {dateUploads.length} upload{dateUploads.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Upload Cards */}
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {dateUploads.map((upload) => {
                    const dateInfo = formatDate(upload.createdAt);
                    return (
                      <motion.div
                        key={upload.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="hover:border-zinc-300 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              {/* Thumbnail */}
                              <div className="flex-shrink-0">
                                {upload.thumbnailUrl && upload.status === "completed" ? (
                                  <div className="relative group">
                                    <img
                                      src={upload.thumbnailUrl}
                                      alt={upload.title}
                                      className="w-40 h-[90px] object-cover rounded-lg bg-zinc-200"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90' fill='%23e4e4e7'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717b' font-size='10'%3ENo Preview%3C/text%3E%3C/svg%3E";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Play className="h-8 w-8 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-40 h-[90px] bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
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
                                {/* Title Row */}
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-zinc-900 dark:text-zinc-50 truncate pr-2">
                                    {upload.title}
                                  </h4>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {getStatusBadge(upload.status)}
                                    {upload.status === "completed" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => window.open(upload.contentUrl, "_blank")}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        View
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Meta Row */}
                                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                                  <span className="flex items-center gap-1 capitalize">
                                    {getPrivacyIcon(upload.privacyStatus)}
                                    {upload.privacyStatus}
                                  </span>
                                  <span>•</span>
                                  <span>{upload.categoryName || "Uncategorized"}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(upload.fileSize)}</span>
                                  <span>•</span>
                                  <span title={dateInfo.full}>{dateInfo.relative}</span>
                                </div>

                                {/* Channel */}
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="bg-red-600 text-white p-0.5 rounded">
                                    <YouTubeIcon className="h-3 w-3" />
                                  </div>
                                  <span className="text-sm text-zinc-600">
                                    {upload.channelName}
                                    {upload.channelHandle && (
                                      <span className="text-zinc-400 ml-1">
                                        {upload.channelHandle}
                                      </span>
                                    )}
                                  </span>
                                </div>

                                {/* Tags */}
                                {upload.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-3">
                                    {upload.tags.slice(0, 8).map((tag, i) => (
                                      <span
                                        key={i}
                                        className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                    {upload.tags.length > 8 && (
                                      <span className="text-xs px-2 py-0.5 text-zinc-400">
                                        +{upload.tags.length - 8} more
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Error Message */}
                                {upload.errorMessage && (
                                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-sm text-red-600">
                                      <AlertCircle className="h-4 w-4 inline mr-1" />
                                      Error: {upload.errorMessage}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
