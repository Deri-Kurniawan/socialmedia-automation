"use client"

import * as React from "react"
import { format, setHours, setMinutes } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  disabled?: boolean
  minDate?: Date
  showEnableToggle?: boolean
  enabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  label?: string
  description?: string
}

export function DateTimePicker({
  date,
  setDate,
  disabled = false,
  minDate,
  showEnableToggle = false,
  enabled = true,
  onEnabledChange,
  label = "Schedule Upload",
  description = "Schedule when your video will be published",
}: DateTimePickerProps) {
  const [selectedTime, setSelectedTime] = React.useState(
    date ? format(date, "HH:mm") : "09:00"
  )

  // Update time when date changes externally
  React.useEffect(() => {
    if (date) {
      setSelectedTime(format(date, "HH:mm"))
    }
  }, [date])

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value
    setSelectedTime(timeValue)

    if (date) {
      const [hours, minutes] = timeValue.split(":").map(Number)
      const newDate = setMinutes(setHours(date, hours), minutes)
      setDate(newDate)
    }
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = selectedTime.split(":").map(Number)
      const newDate = setMinutes(setHours(selectedDate, hours || 9), minutes || 0)
      setDate(newDate)
    } else {
      setDate(undefined)
    }
  }

  const isDisabled = disabled || (showEnableToggle && !enabled)

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      {showEnableToggle && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="schedule-toggle">{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            id="schedule-toggle"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Date/Time picker - Stacked layout */}
      <div
        className={cn(
          "grid gap-3 transition-opacity",
          isDisabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              disabled={(calendarDate) => {
                if (minDate) {
                  return calendarDate < new Date(minDate.setHours(0, 0, 0, 0))
                }
                // Disable past dates
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return calendarDate < today
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Time Picker */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            value={selectedTime}
            onChange={handleTimeChange}
            disabled={isDisabled}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}

// Preset options for quick scheduling
export const schedulePresets = [
  { label: "Now", value: "now", getDate: () => new Date() },
  { label: "In 1 hour", value: "1h", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "In 3 hours", value: "3h", getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  {
    label: "Tomorrow", value: "tomorrow", getDate: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    }
  },
  {
    label: "This weekend", value: "weekend", getDate: () => {
      const d = new Date()
      const day = d.getDay()
      const daysUntilSaturday = 6 - day
      d.setDate(d.getDate() + (daysUntilSaturday <= 0 ? 7 + daysUntilSaturday : daysUntilSaturday))
      d.setHours(10, 0, 0, 0)
      return d
    }
  },
]

export function DateTimePickerWithPresets({
  date,
  setDate,
  disabled = false,
  showEnableToggle = false,
  enabled = true,
  onEnabledChange,
  label,
  description,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const applyPreset = (preset: typeof schedulePresets[0]) => {
    const newDate = preset.getDate()
    setDate(newDate)
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      {showEnableToggle && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="schedule-toggle-presets">{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            id="schedule-toggle-presets"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
          />
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              disabled={disabled || (showEnableToggle && !enabled)}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP 'at' HH:mm") : <span>Schedule upload...</span>}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 p-2">
            {/* Presets */}
            <div className="flex flex-wrap gap-1">
              {schedulePresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="border-t my-2" />

            {/* Calendar */}
            <DateTimePicker
              date={date}
              setDate={setDate}
              disabled={disabled}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
