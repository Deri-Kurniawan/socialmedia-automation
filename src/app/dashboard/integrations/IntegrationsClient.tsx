"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle,
  RefreshCw,
  Plus,
  AlertCircle,
  Trash2,
  Star,
  ExternalLink,
  Info,
  X,
  Lock,
  Eye,
  EyeOff,
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
    try {
      const result = await disconnectIntegration(integrationId);
      if (result.success) {
        toast.success("Integration disconnected");
        refreshIntegrations();
      } else {
        toast.error(result.error || "Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect integration");
    }
  };

  const handleSetDefault = async (integrationId: string, platform: string) => {
    try {
      const result = await setDefaultIntegration(integrationId, platform);
      if (result.success) {
        toast.success("Default account updated");
        refreshIntegrations();
      } else {
        toast.error(result.error || "Failed to update default");
      }
    } catch (error) {
      toast.error("Failed to update default account");
    }
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Integrations</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Manage your connected social media accounts
        </p>
      </div>

      {/* Active Integrations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            {getActiveIntegrations().length} channel
            {getActiveIntegrations().length !== 1 ? "s" : ""} connected
            {googleAccounts.length > 0 && (
              <span className="ml-2">
                across {googleAccounts.length} Google account{googleAccounts.length !== 1 ? "s" : ""}
              </span>
            )}
          </CardDescription>
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
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {account.email?.charAt(0).toUpperCase() || "G"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                      return (
                        <div
                          key={integration.id}
                          className="flex items-start gap-4 p-4 border rounded-lg hover:border-zinc-300 transition-colors"
                        >
                          {/* Platform Icon */}
                          <div
                            className={`${config?.color || "bg-zinc-500"} text-white p-3 rounded-lg`}
                          >
                            {config?.icon || <CheckCircle className="h-6 w-6" />}
                          </div>

                          {/* Integration Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {integration.name}
                              </h3>
                              {integration.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {config?.name || integration.platform}
                              {integration.handle && (
                                <span className="ml-1">• {integration.handle}</span>
                              )}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Connected{" "}
                              {new Date(integration.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {/* Info Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIntegrationForInfo(integration);
                                setShowInfoModal(true);
                              }}
                              className="text-zinc-500 hover:text-blue-600"
                            >
                              <Info className="h-4 w-4 mr-1" />
                              Info
                            </Button>

                            {/* Set Default Toggle */}
                            {getPlatformIntegrations(integration.platform).length > 1 && (
                              <div className="flex items-center gap-2 mr-4">
                                <Switch
                                  checked={integration.isDefault}
                                  onCheckedChange={() =>
                                    handleSetDefault(integration.id, integration.platform)
                                  }
                                />
                                <span className="text-sm text-zinc-500">Default</span>
                              </div>
                            )}

                            {/* Reconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reconnectIntegration(integration.id, integration.platform)
                              }
                              disabled={isRefreshing === integration.id}
                              className="text-zinc-500 hover:text-zinc-900"
                            >
                              <RefreshCw
                                className={`h-4 w-4 mr-1 ${
                                  isRefreshing === integration.id ? "animate-spin" : ""
                                }`}
                              />
                              Reconnect
                            </Button>

                            {/* Disconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Disconnect
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
                  <div className="flex items-center gap-2 px-1">
                    <p className="text-sm font-medium text-zinc-500">Other Channels</p>
                  </div>
                  <div className="space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                    {ungroupedIntegrations.map((integration) => {
                      const config = PLATFORM_CONFIG[integration.platform];
                      return (
                        <div
                          key={integration.id}
                          className="flex items-start gap-4 p-4 border rounded-lg hover:border-zinc-300 transition-colors"
                        >
                          {/* Platform Icon */}
                          <div
                            className={`${config?.color || "bg-zinc-500"} text-white p-3 rounded-lg`}
                          >
                            {config?.icon || <CheckCircle className="h-6 w-6" />}
                          </div>

                          {/* Integration Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {integration.name}
                              </h3>
                              {integration.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              {config?.name || integration.platform}
                              {integration.handle && (
                                <span className="ml-1">• {integration.handle}</span>
                              )}
                            </p>
                            {integration.googleAccountEmail && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Google: {integration.googleAccountEmail}
                              </p>
                            )}
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Connected{" "}
                              {new Date(integration.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {/* Info Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIntegrationForInfo(integration);
                                setShowInfoModal(true);
                              }}
                              className="text-zinc-500 hover:text-blue-600"
                            >
                              <Info className="h-4 w-4 mr-1" />
                              Info
                            </Button>

                            {/* Set Default Toggle */}
                            {getPlatformIntegrations(integration.platform).length > 1 && (
                              <div className="flex items-center gap-2 mr-4">
                                <Switch
                                  checked={integration.isDefault}
                                  onCheckedChange={() =>
                                    handleSetDefault(integration.id, integration.platform)
                                  }
                                />
                                <span className="text-sm text-zinc-500">Default</span>
                              </div>
                            )}

                            {/* Reconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reconnectIntegration(integration.id, integration.platform)
                              }
                              disabled={isRefreshing === integration.id}
                              className="text-zinc-500 hover:text-zinc-900"
                            >
                              <RefreshCw
                                className={`h-4 w-4 mr-1 ${
                                  isRefreshing === integration.id ? "animate-spin" : ""
                                }`}
                              />
                              Reconnect
                            </Button>

                            {/* Disconnect Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Disconnect
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

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Available Platforms
          </CardTitle>
          <CardDescription>
            Connect YouTube channels with full upload permissions. You can add the same channel multiple times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
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
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {integrationCount} connected
                        </Badge>
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
                      onClick={() => startConnectFlow(platform, integrationCount > 0)}
                    >
                      {integrationCount > 0 ? (
                        <><Plus className="h-4 w-4 mr-1" /> Add Another Channel</>
                      ) : (
                        <><ExternalLink className="h-4 w-4 mr-1" /> Connect YouTube</>
                      )}
                    </Button>
                    
                    {integrationCount > 0 && (
                      <p className="text-xs text-zinc-400 mt-2 text-center">
                        Use different Google account?{" "}
                        <button 
                          onClick={() => startConnectFlow(platform, true)}
                          className="text-blue-600 hover:underline"
                        >
                          Switch account
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Integration Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="sm:max-w-lg">
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
                    <p className="text-sm text-zinc-500">
                      {selectedIntegrationForInfo.handle}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                    <span className="text-xs text-green-600 font-medium">
                      {selectedIntegrationForInfo.isActive ? "Active" : "Inactive"}
                    </span>
                    {selectedIntegrationForInfo.isDefault && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
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
                      {new Date(selectedIntegrationForInfo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Last Updated</p>
                    <p className="font-medium">
                      {new Date(selectedIntegrationForInfo.updatedAt).toLocaleDateString()}
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
              <div className="space-y-3">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-50 text-sm">
                  Granted Permissions
                </h4>
                <p className="text-xs text-zinc-500">
                  This integration has been granted the following permissions via OAuth:
                </p>
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

    </div>
  );
}
