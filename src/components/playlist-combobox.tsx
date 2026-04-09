"use client";

import * as React from "react";
import { Play, ListVideo, Check, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface Playlist {
  id: string;
  title: string;
  description?: string | null;
  itemCount: number;
  privacyStatus: "public" | "private" | "unlisted";
  thumbnailUrl?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
}

interface PlaylistComboboxProps {
  playlists: Playlist[];
  value?: string | null;
  onValueChange: (playlistId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showItemCount?: boolean;
  showPrivacyBadge?: boolean;
  emptyMessage?: string;
  groupByChannel?: boolean;
}

function getPlaylistThumbnail(playlist: Playlist): string | undefined {
  if (playlist.thumbnailUrl) return playlist.thumbnailUrl;
  return undefined;
}

function formatItemCount(count: number): string {
  return `${count} ${count === 1 ? "video" : "videos"}`;
}

function getPrivacyBadgeClasses(status: Playlist["privacyStatus"]): string {
  switch (status) {
    case "public":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "unlisted":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "private":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

const PlaylistIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    <path d="M12 12l5 3.5-5 3.5V12z" />
  </svg>
);

export function PlaylistCombobox({
  playlists,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select a playlist",
  className,
  showItemCount = true,
  showPrivacyBadge = true,
  emptyMessage = "No playlists found.",
  groupByChannel = false,
}: PlaylistComboboxProps) {
  const selectedPlaylist = React.useMemo(
    () => playlists.find((p) => p.id === value),
    [playlists, value]
  );

  const groupedPlaylists = React.useMemo(() => {
    if (!groupByChannel) return null;

    const groups = new Map<string, Playlist[]>();
    const ungrouped: Playlist[] = [];

    for (const playlist of playlists) {
      if (playlist.channelId && playlist.channelTitle) {
        const existing = groups.get(playlist.channelId) || [];
        existing.push(playlist);
        groups.set(playlist.channelId, existing);
      } else {
        ungrouped.push(playlist);
      }
    }

    const result: { channelId: string; channelTitle: string; playlists: Playlist[] }[] = [];
    for (const [channelId, channelPlaylists] of groups) {
      const channelTitle = channelPlaylists[0]?.channelTitle || "Unknown Channel";
      result.push({
        channelId,
        channelTitle,
        playlists: channelPlaylists.sort((a, b) => a.title.localeCompare(b.title)),
      });
    }
    result.sort((a, b) => a.channelTitle.localeCompare(b.channelTitle));

    return { groups: result, ungrouped };
  }, [playlists, groupByChannel]);

  const handleValueChange = React.useCallback(
    (selectedTitle: string) => {
      const found = playlists.find((p) => p.title === selectedTitle);
      if (found) {
        onValueChange(found.id);
      } else if (selectedTitle === "" || selectedTitle === placeholder) {
        onValueChange(null);
      }
    },
    [playlists, onValueChange, placeholder]
  );

  const handleClear = React.useCallback(() => {
    onValueChange(null);
  }, [onValueChange]);

  const displayValue = selectedPlaylist?.title || "";

  const playlistTitles = React.useMemo(
    () => playlists.map((p) => p.title),
    [playlists]
  );

  if (playlists.length === 0) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg border bg-muted/50", className)}>
        <ListVideo className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No playlists available</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {selectedPlaylist && (
        <div className="flex items-center gap-3 p-2 rounded-lg border bg-card">
          <Avatar className="h-10 w-10 rounded-lg">
            <AvatarImage
              src={getPlaylistThumbnail(selectedPlaylist)}
              alt={selectedPlaylist.title}
              className="rounded-lg object-cover"
            />
            <AvatarFallback className="bg-red-600 text-white rounded-lg">
              <PlaylistIcon className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedPlaylist.title}</p>
            <div className="flex items-center gap-2">
              {showItemCount && (
                <span className="text-xs text-muted-foreground">
                  {formatItemCount(selectedPlaylist.itemCount)}
                </span>
              )}
              {showPrivacyBadge && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium",
                    getPrivacyBadgeClasses(selectedPlaylist.privacyStatus)
                  )}
                >
                  {selectedPlaylist.privacyStatus}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Combobox
        value={displayValue}
        onValueChange={handleValueChange}
        items={playlistTitles}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={selectedPlaylist ? "Change playlist..." : placeholder}
          showTrigger
          showClear={!selectedPlaylist}
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {groupByChannel && groupedPlaylists ? (
              <>
                {groupedPlaylists.groups.map((group) => (
                  <ComboboxGroup key={group.channelId}>
                    <ComboboxLabel className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {group.channelTitle}
                      </span>
                    </ComboboxLabel>
                    {group.playlists.map((playlist) => (
                      <PlaylistComboboxItem
                        key={playlist.id}
                        playlist={playlist}
                        isSelected={playlist.id === value}
                        showItemCount={showItemCount}
                        showPrivacyBadge={showPrivacyBadge}
                      />
                    ))}
                  </ComboboxGroup>
                ))}
                {groupedPlaylists.ungrouped.length > 0 && (
                  <ComboboxGroup>
                    <ComboboxLabel>Other Playlists</ComboboxLabel>
                    {groupedPlaylists.ungrouped.map((playlist) => (
                      <PlaylistComboboxItem
                        key={playlist.id}
                        playlist={playlist}
                        isSelected={playlist.id === value}
                        showItemCount={showItemCount}
                        showPrivacyBadge={showPrivacyBadge}
                      />
                    ))}
                  </ComboboxGroup>
                )}
              </>
            ) : (
              playlists.map((playlist) => (
                <PlaylistComboboxItem
                  key={playlist.id}
                  playlist={playlist}
                  isSelected={playlist.id === value}
                  showItemCount={showItemCount}
                  showPrivacyBadge={showPrivacyBadge}
                />
              ))
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

interface PlaylistComboboxItemProps {
  playlist: Playlist;
  isSelected: boolean;
  showItemCount: boolean;
  showPrivacyBadge: boolean;
}

function PlaylistComboboxItem({
  playlist,
  isSelected,
  showItemCount,
  showPrivacyBadge,
}: PlaylistComboboxItemProps) {
  return (
    <ComboboxItem key={playlist.title} value={playlist.title}>
      <div className="flex items-center gap-3 w-full min-w-0">
        <Avatar className="h-8 w-8 rounded-lg shrink-0">
          <AvatarImage
            src={getPlaylistThumbnail(playlist)}
            alt={playlist.title}
            className="rounded-lg object-cover"
          />
          <AvatarFallback className="bg-red-600 text-white rounded-lg text-xs">
            <PlaylistIcon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{playlist.title}</p>
          <div className="flex items-center gap-2">
            {showItemCount && (
              <span className="text-xs text-muted-foreground">
                {formatItemCount(playlist.itemCount)}
              </span>
            )}
            {showPrivacyBadge && (
              <span
                className={cn(
                  "text-[10px] px-1 py-0.5 rounded-full uppercase tracking-wider font-medium",
                  getPrivacyBadgeClasses(playlist.privacyStatus)
                )}
              >
                {playlist.privacyStatus}
              </span>
            )}
          </div>
          {playlist.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {playlist.description}
            </p>
          )}
        </div>
        {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
      </div>
    </ComboboxItem>
  );
}

interface PlaylistBadgeProps {
  playlist: Playlist;
  onRemove?: () => void;
  className?: string;
}

export function PlaylistBadge({ playlist, onRemove, className }: PlaylistBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-card text-sm",
        className
      )}
    >
      <Avatar className="h-5 w-5 rounded">
        <AvatarImage
          src={getPlaylistThumbnail(playlist)}
          alt={playlist.title}
          className="rounded object-cover"
        />
        <AvatarFallback className="bg-red-600 text-white rounded text-[10px]">
          <Play className="h-3 w-3" />
        </AvatarFallback>
      </Avatar>
      <span className="font-medium truncate max-w-[150px]">{playlist.title}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={`Remove ${playlist.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default PlaylistCombobox;

