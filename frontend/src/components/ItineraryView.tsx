import { Itinerary } from '@shared/types';
import { useState } from 'react';

interface ItineraryViewProps {
  itinerary: Itinerary | null;
  editedDayNum?: number;
  lastChanges?: string[];
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({ itinerary, editedDayNum, lastChanges = [] }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!itinerary) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p className="text-lg">No itinerary yet. Start by recording a voice command!</p>
      </div>
    );
  }

  const activeDay = itinerary.days[activeTab];

  return (
    <div className="space-y-4 p-4">
      {/* Day Tabs */}
      <div className="flex gap-2 border-b">
        {itinerary.days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`py-2 px-4 font-medium border-b-2 transition ${
              activeTab === idx
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            } ${editedDayNum === idx + 1 ? 'bg-yellow-50' : ''}`}
          >
            {day.name}
          </button>
        ))}
      </div>

      {/* Active Day Blocks */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{activeDay.name}</h3>
        {activeDay.blocks.map((block, blockIdx) => (
          <div
            key={blockIdx}
            className={`p-4 border rounded-lg transition ${
              editedDayNum === activeTab + 1 && lastChanges.includes(block.timeOfDay)
                ? 'bg-yellow-100 border-yellow-300'
                : 'bg-white hover:border-blue-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-lg">{block.timeOfDay}</h4>
                <p className="text-slate-700 text-base">{block.title}</p>
              </div>
              {editedDayNum === activeTab + 1 && lastChanges.includes(block.timeOfDay) && (
                <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded">
                  Updated
                </span>
              )}
            </div>
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              <p>Duration: {block.durationHours} hours</p>
              {block.travelFromPrev && block.travelFromPrev.minutes > 0 && (
                <p>
                  🚗 ~{block.travelFromPrev.minutes} min {block.travelFromPrev.method}
                </p>
              )}
              {block.notes.length > 0 && (
                <div className="mt-2">
                  {block.notes.map((note, idx) => (
                    <p key={idx} className="text-slate-700">
                      • {note}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Day Summary */}
      <div className="p-3 bg-slate-100 rounded text-sm text-slate-700">
        <p>
          <strong>Total planned:</strong> {activeDay.totalPlannedHours} hours
        </p>
      </div>
    </div>
  );
};
