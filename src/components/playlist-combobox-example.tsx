"use client";

import * as React from "react";
import { PlaylistCombobox, Playlist, PlaylistBadge } from "./playlist-combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Example playlists data
const EXAMPLE_PLAYLISTS: Playlist[] = [
  {
    id: "PL1",
    title: "My Favorite Gaming Moments",
    description: "Best highlights from streaming sessions",
    itemCount: 42,
    privacyStatus: "public",
    thumbnailUrl: null,
    channelId: "UC1",
    channelTitle: "Gaming Channel",
  },
  {
    id: "PL2",
    title: "Tutorial Series - React",
    description: "Complete React course for beginners",
    itemCount: 15,
    privacyStatus: "public",
    thumbnailUrl: null,
    channelId: "UC2",
    channelTitle: "Tech Tutorials",
  },
  {
    id: "PL3",
    title: "Unlisted Drafts",
    description: "Work in progress videos",
    itemCount: 3,
    privacyStatus: "unlisted",
    thumbnailUrl: null,
    channelId: "UC1",
    channelTitle: "Gaming Channel",
  },
  {
    id: "PL4",
    title: "Private Archive",
    description: "Old content kept for reference",
    itemCount: 127,
    privacyStatus: "private",
    thumbnailUrl: null,
    channelId: "UC3",
    channelTitle: "Personal Channel",
  },
  {
    id: "PL5",
    title: "Music Collection",
    description: "Royalty free music for videos",
    itemCount: 89,
    privacyStatus: "public",
    thumbnailUrl: null,
    channelId: "UC2",
    channelTitle: "Tech Tutorials",
  },
];

export function PlaylistComboboxExample() {
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string | null>(null);
  const [groupByChannel, setGroupByChannel] = React.useState(false);

  const selectedPlaylist = EXAMPLE_PLAYLISTS.find((p) => p.id === selectedPlaylistId);

  return (
    <div className="space-y-6 max-w-md">
      {/* Basic Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Select Playlist</CardTitle>
          <CardDescription>
            Choose a playlist to add your video to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Playlist</Label>
            <PlaylistCombobox
              playlists={EXAMPLE_PLAYLISTS}
              value={selectedPlaylistId}
              onValueChange={setSelectedPlaylistId}
              placeholder="Search playlists..."
              groupByChannel={groupByChannel}
            />
          </div>

          {selectedPlaylist && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Selected: <span className="font-medium text-foreground">{selectedPlaylist.title}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {selectedPlaylist.id} | Videos: {selectedPlaylist.itemCount}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouped by Channel */}
      <Card>
        <CardHeader>
          <CardTitle>Grouped View</CardTitle>
          <CardDescription>
            Playlists organized by channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Playlist (Grouped)</Label>
            <PlaylistCombobox
              playlists={EXAMPLE_PLAYLISTS}
              value={selectedPlaylistId}
              onValueChange={setSelectedPlaylistId}
              placeholder="Search playlists..."
              groupByChannel={true}
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupByChannel(!groupByChannel)}
            >
              {groupByChannel ? "Ungrouped" : "Grouped by Channel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Playlist Badge Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Playlist Badges</CardTitle>
          <CardDescription>
            Compact display of selected playlists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PLAYLISTS.slice(0, 3).map((playlist) => (
              <PlaylistBadge
                key={playlist.id}
                playlist={playlist}
                onRemove={() => console.log(`Remove ${playlist.title}`)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PlaylistComboboxExample;

