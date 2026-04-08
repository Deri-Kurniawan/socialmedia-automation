"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createPortal } from "react-dom";

interface Integration {
  id: string;
  platform: string;
  name: string;
  handle: string | null;
  isDefault: boolean;
  googleAccountId: string | null;
  googleAccountEmail: string | null;
  metadata: {
    thumbnail?: string;
  } | null;
}

interface ChannelSelectorProps {
  integrations: Integration[];
  selectedIntegrationId: string | null;
  onSelect: (integrationId: string) => void;
}

interface GoogleAccountGroup {
  accountId: string;
  email: string | null;
  channels: Integration[];
}

export function ChannelSelector({
  integrations,
  selectedIntegrationId,
  onSelect,
}: ChannelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIntegration = integrations.find(
    (i) => i.id === selectedIntegrationId
  );

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown on scroll or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => setIsOpen(false);
    const handleResize = () => setIsOpen(false);

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  // Group integrations by Google account
  const groupedIntegrations = useMemo(() => {
    const groups = new Map<string, Integration[]>();
    const ungrouped: Integration[] = [];

    for (const integration of integrations) {
      if (integration.googleAccountId) {
        const existing = groups.get(integration.googleAccountId) || [];
        existing.push(integration);
        groups.set(integration.googleAccountId, existing);
      } else {
        ungrouped.push(integration);
      }
    }

    // Convert to array and sort
    const result: GoogleAccountGroup[] = [];
    for (const [accountId, channels] of groups) {
      result.push({
        accountId,
        email: channels[0]?.googleAccountEmail || null,
        channels: channels.sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1)),
      });
    }
    // Sort by email
    result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));

    return { groups: result, ungrouped };
  }, [integrations]);

  // YouTube Icon Component
  const YouTubeIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );

  if (integrations.length === 0) {
    return null;
  }

  // Single integration - show as card without dropdown
  if (integrations.length === 1) {
    const integration = integrations[0];
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-zinc-950">
        <Avatar className="h-10 w-10 rounded-lg">
          <AvatarImage
            src={integration.metadata?.thumbnail || ""}
            alt={integration.name}
            className="rounded-lg"
          />
          <AvatarFallback className="bg-red-600 text-white rounded-lg">
            <YouTubeIcon className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{integration.name}</p>
          {integration.handle && (
            <p className="text-xs text-zinc-500 truncate">{integration.handle}</p>
          )}
        </div>
        {integration.isDefault && (
          <span className="text-xs text-zinc-400">Default</span>
        )}
      </div>
    );
  }

  // Multiple integrations - show dropdown selector
  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <Avatar className="h-10 w-10 rounded-lg">
          <AvatarImage
            src={selectedIntegration?.metadata?.thumbnail || ""}
            alt={selectedIntegration?.name || "Select channel"}
            className="rounded-lg"
          />
          <AvatarFallback className="bg-red-600 text-white rounded-lg">
            <YouTubeIcon className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-sm truncate">
            {selectedIntegration?.name || "Select channel"}
          </p>
          {selectedIntegration?.handle ? (
            <p className="text-xs text-zinc-500 truncate">
              {selectedIntegration.handle}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Click to select channel
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {integrations.length} channels
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""
              }`}
          />
        </div>
      </button>

      {/* Dropdown Menu - Rendered via Portal to escape overflow:hidden parents */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            {createPortal(
              <div
                className="fixed inset-0 z-[100]"
                onClick={() => setIsOpen(false)}
              />,
              document.body
            )}

            {/* Dropdown - Fixed position to escape parent overflow */}
            {createPortal(
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[101] bg-white dark:bg-zinc-950 border rounded-lg shadow-xl"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  maxHeight: "320px",
                }}
              >
                <div className="overflow-auto py-1" style={{ maxHeight: "320px" }}>
                  {/* Grouped by Google Account */}
                  {groupedIntegrations.groups.map((group) => (
                    <div key={group.accountId} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      {/* Google Account Header */}
                      {/* <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {group.email?.charAt(0).toUpperCase() || "G"}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
                            {group.email || "Google Account"}
                          </p>
                        </div>
                      </div> */}
                      {/* Channels for this Google Account */}
                      {group.channels.map((integration) => (
                        <button
                          key={integration.id}
                          onClick={() => {
                            onSelect(integration.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${selectedIntegrationId === integration.id
                            ? "bg-zinc-50 dark:bg-zinc-900"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                        >
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage
                              src={integration.metadata?.thumbnail || ""}
                              alt={integration.name}
                              className="rounded-lg"
                            />
                            <AvatarFallback className="bg-red-600 text-white rounded-lg text-xs">
                              <YouTubeIcon className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {integration.name}
                              </p>
                              {integration.isDefault && (
                                <span className="text-xs text-zinc-400">(default)</span>
                              )}
                            </div>
                            {integration.handle && (
                              <p className="text-xs text-zinc-500 truncate">
                                {integration.handle}
                              </p>
                            )}
                          </div>
                          {selectedIntegrationId === integration.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}

                  {/* Ungrouped Integrations */}
                  {groupedIntegrations.ungrouped.length > 0 && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800">
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50">
                        <p className="text-xs font-medium text-zinc-500">Other Channels</p>
                      </div>
                      {groupedIntegrations.ungrouped.map((integration) => (
                        <button
                          key={integration.id}
                          onClick={() => {
                            onSelect(integration.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${selectedIntegrationId === integration.id
                            ? "bg-zinc-50 dark:bg-zinc-900"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                        >
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage
                              src={integration.metadata?.thumbnail || ""}
                              alt={integration.name}
                              className="rounded-lg"
                            />
                            <AvatarFallback className="bg-red-600 text-white rounded-lg text-xs">
                              <YouTubeIcon className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {integration.name}
                              </p>
                              {integration.isDefault && (
                                <span className="text-xs text-zinc-400">(default)</span>
                              )}
                            </div>
                            {integration.handle && (
                              <p className="text-xs text-zinc-500 truncate">
                                {integration.handle}
                              </p>
                            )}
                          </div>
                          {selectedIntegrationId === integration.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>,
              document.body
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
