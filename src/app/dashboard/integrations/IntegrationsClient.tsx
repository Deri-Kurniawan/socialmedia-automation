"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  RefreshCw,
  Plus,
  AlertCircle,
  Trash2,
  Star,
  ExternalLink,
  Info,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getIntegrations,
  getIntegrationsByGoogleAccount,
  disconnectIntegration,
  setDefaultIntegration,
  type Integration,
  type GoogleAccount,
} from "./actions";

// YouTube Icon Component
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Platform configuration
const PLATFORM_CONFIG: Record<
  string,
  {
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    provider: string;
  }
> = {
  youtube: {
    name: "YouTube",
    icon: <YouTubeIcon className="h-6 w-6" />,
    color: "bg-red-600",
    description: "Upload videos to your YouTube channel",
    provider: "google",
  },
};

interface IntegrationsClientProps {
  initialIntegrations: Integration[];
  initialGoogleAccounts: GoogleAccount[];
  initialUngrouped: Integration[];
}

export function IntegrationsClient({ 
  initialIntegrations, 
  initialGoogleAccounts,
  initialUngrouped 
}: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>(initialGoogleAccounts);
  const [ungroupedIntegrations, setUngroupedIntegrations] = useState<Integration[]>(initialUngrouped);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedIntegrationForInfo, setSelectedIntegrationForInfo] = useState<Integration | null>(null);
  const [showPlatformsModal, setShowPlatformsModal] = useState(false);

  // Handle OAuth callback results
  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected") === "true";
    const multiple = url.searchParams.get("multiple") === "true";
    const count = url.searchParams.get("count");
    const channel = url.searchParams.get("channel");
    const error = url.searchParams.get("error");

    // Clear query params
    if (connected || multiple || error) {
      window.history.replaceState({}, document.title, "/dashboard/integrations");
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You denied the authorization request.",
        no_channels: "No YouTube channels found in this Google account.",
        callback_failed: "Failed to complete YouTube connection.",
        invalid_request: "Invalid request. Please try again.",
        invalid_state: "Security validation failed. Please try again.",
        oauth_failed: "OAuth initialization failed. Please try again.",
      };
      toast.error("Connection failed", {
        description: errorMessages[error] || "An unknown error occurred.",
      });
      return;
    }

    if (connected) {
      toast.success("YouTube connected!", {
        description: channel 
          ? `Successfully connected ${channel}`
          : "Your YouTube channel has been connected.",
      });
      refreshIntegrations();
    }

    if (multiple) {
      toast.success("YouTube connected!", {
        description: `Successfully connected ${count} YouTube channels.`,
      });
      refreshIntegrations();
    }
  }, []);

  const refreshIntegrations = async () => {
    setIsLoading(true);
    try {
      // Fetch both flat list and grouped by Google account
      const [flatResult, groupedResult] = await Promise.all([
        getIntegrations(),
        getIntegrationsByGoogleAccount(),
      ]);

      if (flatResult.success && flatResult.integrations) {
        setIntegrations(flatResult.integrations);
      }

      if (groupedResult.success) {
        setGoogleAccounts(groupedResult.accounts || []);
        setUngroupedIntegrations(groupedResult.ungrouped || []);
      }
    } catch (error) {
      console.error("Failed to refresh integrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Note: Initial data is loaded server-side, no client-side fetch on mount needed
  // refreshIntegrations is only called after mutations (disconnect, setDefault, etc.)

  const handleDisconnect = async (integrationId: string) => {
    await toast.promise(
      disconnectIntegration(integrationId).then((result) => {
        if (!result.success) throw new Error(result.error || "Failed to disconnect");
        refreshIntegrations();
        return result;
      }),
      {
        loading: "Disconnecting...",
        success: "Integration disconnected",
        error: (err) => err.message || "Failed to disconnect integration",
      }
    );
  };

  const handleSetDefault = async (integrationId: string, platform: string) => {
    await toast.promise(
      setDefaultIntegration(integrationId, platform).then((result) => {
        if (!result.success) throw new Error(result.error || "Failed to update default");
        refreshIntegrations();
        return result;
      }),
      {
        loading: "Updating default account...",
        success: "Default account updated",
        error: (err) => err.message || "Failed to update default account",
      }
    );
  };

  // Reconnect/re-authenticate an integration (uses separate YouTube OAuth flow)
  const reconnectIntegration = async (integrationId: string, platform: string) => {
    if (platform === "youtube") {
      // Redirect to separate YouTube OAuth flow (not login flow)
      window.location.href = "/api/auth/youtube?redirect=/dashboard/integrations";
    }
  };

  // Start the integration OAuth flow (separate from login)
  const startConnectFlow = (platform: string, switchAccount = false) => {
    if (platform === "youtube") {
      // Use separate YouTube OAuth endpoint with full YouTube scopes
      const params = new URLSearchParams();
      params.set("redirect", "/dashboard/integrations");
      if (switchAccount) {
        params.set("switchAccount", "true");
      }
      window.location.href = `/api/auth/youtube?${params.toString()}`;
    }
  };

  const getActiveIntegrations = () =>
    integrations.filter((i) => i.isActive);

  const getPlatformIntegrations = (platform: string) =>
    integrations.filter((i) => i.platform === platform && i.isActive);

  // Show skeleton only when explicitly loading (initial data fetch from server)
  // Don't show skeleton just because there are no integrations (that's an empty state, not loading)
  if (isLoading) {
    return (
      <div className="max-w-[1440px]">
        <div className="mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px]">
      {/* Page Title */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Integrations</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage your connected social media accounts
          </p>
        </div>
        <Button onClick={() => setShowPlatformsModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Active Integrations */}
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2.5">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </div>
                Connected Accounts
              </CardTitle>
              <CardDescription className="mt-1.5 flex items-center gap-2">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {getActiveIntegrations().length} channel{getActiveIntegrations().length !== 1 ? "s" : ""}
                </span>
                {googleAccounts.length > 0 && (
                  <>
                    <span className="text-zinc-400">•</span>
                    <span>
                      {googleAccounts.length} Google account{googleAccounts.length !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </CardDescription>
            </div>
            {getActiveIntegrations().length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                All systems active
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {getActiveIntegrations().length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
              <p>No accounts connected yet.</p>
              <p className="text-sm mt-1">
                Connect a platform below to start uploading.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group by Google Account */}
              {googleAccounts.map((account) => (
                <div key={account.accountId} className="space-y-3">
                  {/* Google Account Header */}
                  <div className="flex items-center gap-3 px-1 py-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {account.email || "Google Account"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {account.channelCount} channel{account.channelCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Channels for this Google Account */}
                  <div className="space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                    {account.channels.map((integration) => {
                      const config = PLATFORM_CONFIG[integration.platform];
                      const isDefault = integration.isDefault;
                      return (
                        <div
                          key={integration.id}
                          className={`group flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                            isDefault 
                              ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30' 
                              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          {/* Platform Icon */}
                          <div className="relative">
                            <div
                              className={`${config?.color || "bg-zinc-500"} text-white p-3 rounded-xl shadow-sm`}
                            >
                              {config?.icon || <CheckCircle className="h-6 w-6" />}
                            </div>
                            {isDefault && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                <Star className="h-3 w-3 text-white fill-white" />
                              </div>
                            )}
                          </div>

                          {/* Integration Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {integration.name}
                              </h3>
                              {isDefault && (
                                <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {config?.name || integration.platform}
                              {integration.handle && (
                                <a 
                                  href={`https://youtube.com/${integration.handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-blue-600 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {' '}@{integration.handle.replace('@', '')}
                                </a>
                              )}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                              <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
                              Connected {format(new Date(integration.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {/* Set Default Toggle - Only show when multiple integrations */}
                            {getPlatformIntegrations(integration.platform).length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefault(integration.id, integration.platform)}
                                className={`h-8 w-8 p-0 ${
                                  isDefault 
                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' 
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                                }`}
                                title={isDefault ? "Default account" : "Set as default"}
                              >
                                <Star className={`h-4 w-4 ${isDefault ? 'fill-current' : ''}`} />
                              </Button>
                            )}

                            {/* Info Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIntegrationForInfo(integration);
                                setShowInfoModal(true);
                              }}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-blue-600 hover:bg-blue-50"
                              title="View details"
                            >
                              <Info className="h-4 w-4" />
                            </Button>

                            {/* Reconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reconnectIntegration(integration.id, integration.platform)
                              }
                              disabled={isRefreshing === integration.id}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                              title="Reconnect"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${
                                  isRefreshing === integration.id ? "animate-spin" : ""
                                }`}
                              />
                            </Button>

                            {/* Disconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                              title="Disconnect"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Ungrouped Integrations (legacy or without googleAccountId) */}
              {ungroupedIntegrations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1 py-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Other Channels
                      </p>
                      <p className="text-xs text-zinc-500">
                        {ungroupedIntegrations.length} channel{ungroupedIntegrations.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                    {ungroupedIntegrations.map((integration) => {
                      const config = PLATFORM_CONFIG[integration.platform];
                      const isDefault = integration.isDefault;
                      return (
                        <div
                          key={integration.id}
                          className={`group flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                            isDefault 
                              ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30' 
                              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          {/* Platform Icon */}
                          <div className="relative">
                            <div
                              className={`${config?.color || "bg-zinc-500"} text-white p-3 rounded-xl shadow-sm`}
                            >
                              {config?.icon || <CheckCircle className="h-6 w-6" />}
                            </div>
                            {isDefault && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                <Star className="h-3 w-3 text-white fill-white" />
                              </div>
                            )}
                          </div>

                          {/* Integration Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {integration.name}
                              </h3>
                              {isDefault && (
                                <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {config?.name || integration.platform}
                              {integration.handle && (
                                <a 
                                  href={`https://youtube.com/${integration.handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-blue-600 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {' '}@{integration.handle.replace('@', '')}
                                </a>
                              )}
                            </p>
                            {integration.googleAccountEmail && (
                              <p className="text-xs text-zinc-400">
                                {integration.googleAccountEmail}
                              </p>
                            )}
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                              <span className="inline-block w-1 h-1 rounded-full bg-green-500"></span>
                              Connected {format(new Date(integration.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {/* Set Default Toggle - Only show when multiple integrations */}
                            {getPlatformIntegrations(integration.platform).length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefault(integration.id, integration.platform)}
                                className={`h-8 w-8 p-0 ${
                                  isDefault 
                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' 
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                                }`}
                                title={isDefault ? "Default account" : "Set as default"}
                              >
                                <Star className={`h-4 w-4 ${isDefault ? 'fill-current' : ''}`} />
                              </Button>
                            )}

                            {/* Info Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIntegrationForInfo(integration);
                                setShowInfoModal(true);
                              }}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-blue-600 hover:bg-blue-50"
                              title="View details"
                            >
                              <Info className="h-4 w-4" />
                            </Button>

                            {/* Reconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reconnectIntegration(integration.id, integration.platform)
                              }
                              disabled={isRefreshing === integration.id}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                              title="Reconnect"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${
                                  isRefreshing === integration.id ? "animate-spin" : ""
                                }`}
                              />
                            </Button>

                            {/* Disconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                              title="Disconnect"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Integration Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this YouTube channel connection
            </DialogDescription>
          </DialogHeader>
          
          {selectedIntegrationForInfo && (
            <div className="space-y-6">
              {/* Channel Info */}
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <div className="h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <YouTubeIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {selectedIntegrationForInfo.name}
                  </p>
                  {selectedIntegrationForInfo.handle && (
                    <a 
                      href={`https://youtube.com/${selectedIntegrationForInfo.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      {selectedIntegrationForInfo.handle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                    <span className="text-xs text-green-600 font-medium">
                      {selectedIntegrationForInfo.isActive ? "Active" : "Inactive"}
                    </span>
                    {selectedIntegrationForInfo.isDefault && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Connection Details */}
              <div className="space-y-3">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-50 text-sm">
                  Connection Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Platform</p>
                    <p className="font-medium capitalize">{selectedIntegrationForInfo.platform}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Connected On</p>
                    <p className="font-medium">
                      {format(new Date(selectedIntegrationForInfo.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Last Updated</p>
                    <p className="font-medium">
                      {format(new Date(selectedIntegrationForInfo.updatedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Integration ID</p>
                    <p className="font-medium text-xs text-zinc-400 truncate">
                      {selectedIntegrationForInfo.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              {(() => {
                // Parse scope and get granted permissions
                const scope = selectedIntegrationForInfo.scope || "";
                const grantedScopes = new Set(scope.split(" ").filter(Boolean));
                
                // All possible permissions with their scope URLs
                const allPermissions = [
                  { scope: "https://www.googleapis.com/auth/youtube", name: "Full YouTube account management", icon: "shield" },
                  { scope: "https://www.googleapis.com/auth/youtube.upload", name: "Upload videos", icon: "upload" },
                  { scope: "https://www.googleapis.com/auth/youtube.readonly", name: "Read channel data", icon: "eye" },
                  { scope: "https://www.googleapis.com/auth/youtube.force-ssl", name: "Manage videos & comments", icon: "edit" },
                  { scope: "https://www.googleapis.com/auth/youtube.channel-memberships.creator", name: "Channel memberships", icon: "users" },
                  { scope: "https://www.googleapis.com/auth/youtubepartner", name: "Content management", icon: "briefcase" },
                  { scope: "https://www.googleapis.com/auth/youtubepartner-channel-audit", name: "Channel audit", icon: "search" },
                  { scope: "https://www.googleapis.com/auth/yt-analytics.readonly", name: "View analytics", icon: "chart" },
                  { scope: "https://www.googleapis.com/auth/yt-analytics-monetary.readonly", name: "Monetization data", icon: "dollar" },
                  { scope: "openid", name: "Authentication", icon: "key" },
                  { scope: "email", name: "Email address", icon: "mail" },
                  { scope: "profile", name: "Profile info", icon: "user" },
                ];

                const grantedCount = allPermissions.filter(p => grantedScopes.has(p.scope)).length;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-50 text-sm">
                        Permissions
                      </h4>
                      <span className="text-xs text-zinc-500">
                        {grantedCount}/{allPermissions.length} granted
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Complete list of permissions available for YouTube integrations:
                    </p>
                    <ul className="space-y-1.5 text-sm max-h-[280px] overflow-y-auto pr-1">
                      {allPermissions.map((permission) => {
                        const isGranted = grantedScopes.has(permission.scope);
                        return (
                          <li 
                            key={permission.scope} 
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              isGranted 
                                ? 'bg-green-50 dark:bg-green-950/20' 
                                : 'bg-zinc-50 dark:bg-zinc-900/50 opacity-60'
                            }`}
                          >
                            <span className={`flex items-center gap-2 ${
                              isGranted ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
                            }`}>
                              {permission.name}
                            </span>
                            <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                              isGranted 
                                ? 'bg-green-500 text-white' 
                                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500'
                            }`}>
                              {isGranted ? '✓' : '×'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {selectedIntegrationForInfo.scope && (
                      <details className="text-xs mt-4">
                        <summary className="text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">
                          View raw scopes
                        </summary>
                        <div className="mt-2 p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-zinc-500 font-mono text-[10px] break-all">
                          {selectedIntegrationForInfo.scope}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}

              {/* Security Note */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <Lock className="h-3 w-3 inline mr-1" />
                  <strong>Security:</strong> Your OAuth tokens are securely stored and encrypted. 
                  Tokens can be revoked at any time by disconnecting this integration.
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={() => setShowInfoModal(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Integration Modal */}
      <Dialog open={showPlatformsModal} onOpenChange={setShowPlatformsModal}>
        <DialogContent className="sm:max-w-xl md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
            <DialogDescription>
              Connect a new social media account to start uploading content.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* YouTube Integration */}
            {(() => {
              const platform = "youtube";
              const platformIntegrations = getPlatformIntegrations(platform);
              const integrationCount = platformIntegrations.length;

              return (
                <div
                  key={platform}
                  className="flex items-start gap-4 p-4 border rounded-lg transition-colors hover:border-zinc-300"
                >
                  {/* YouTube Icon */}
                  <div className="bg-red-600 text-white p-3 rounded-lg">
                    <YouTubeIcon className="h-6 w-6" />
                  </div>

                  {/* Platform Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        YouTube
                      </h3>
                      {integrationCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          {integrationCount} connected
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">
                      Upload videos with full YouTube permissions
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Requires separate Google authorization
                    </p>

                    {/* Connect / Add Another Button */}
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      variant={integrationCount > 0 ? "outline" : "default"}
                      onClick={() => {
                        startConnectFlow(platform, integrationCount > 0);
                        setShowPlatformsModal(false);
                      }}
                    >
                      {integrationCount > 0 ? (
                        <><Plus className="h-4 w-4 mr-1" /> Add Another Channel</>
                      ) : (
                        <><ExternalLink className="h-4 w-4 mr-1" /> Connect YouTube</>
                      )}
                    </Button>
                    

                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
