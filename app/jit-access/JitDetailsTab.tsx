"use client";
import React, { useState } from "react";
import { Clock, CalendarDays, AlignLeft } from "lucide-react";

const JitDetailsTab: React.FC = () => {
  const [accessTiming, setAccessTiming] = useState<"now" | "schedule">("now");
  const [durationHours, setDurationHours] = useState<string>("");
  const [justification, setJustification] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");

  return (
    <div className="space-y-4">

      {/* Access Duration */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Access Duration</h3>
        </div>

        {/* Now / Schedule toggle */}
        <div className="flex justify-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => setAccessTiming("now")}
            className={`w-40 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              accessTiming === "now"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => setAccessTiming("schedule")}
            className={`w-40 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              accessTiming === "schedule"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Schedule for Later
          </button>
        </div>

        {/* Duration hours — always visible */}
        <div className="flex items-center gap-4">
          <label className="w-36 shrink-0 text-sm font-medium text-gray-600">Duration (hours)</label>
          <input
            type="number"
            min={1}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            placeholder="e.g., 4"
            className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Schedule for Later — date / time / timezone */}
      {accessTiming === "schedule" && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">Scheduled Time</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="w-36 shrink-0 text-sm font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="w-36 shrink-0 text-sm font-medium text-gray-600">Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                value="UTC"
                readOnly
                className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-white cursor-default text-center"
              />
            </div>
          </div>
        </div>
      )}

      {/* Justification */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlignLeft className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Justification</h3>
        </div>
        <textarea
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why is this access needed?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white shadow-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

    </div>
  );
};

export default JitDetailsTab;
