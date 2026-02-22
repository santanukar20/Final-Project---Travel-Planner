import { Itinerary } from '@shared/types';
import { useState, useEffect } from 'react';

interface ItineraryViewProps {
  itinerary: Itinerary | null;
  editedDayNum?: number;
  lastChanges?: string[];
  highlightedBlocks?: Set<string>; // "dayIndex-blockIndex" format
  highlightedDays?: Set<number>; // day indices to highlight
}

// Helper to strip internal edit tags from notes
const cleanNote = (note: string): string => {
  return note
    .replace(/\[(?:MAKE_MORE_RELAXED|SET_PACE|REDUCE_TRAVEL|SWAP_TO_INDOOR|ADD_FOOD_PLACE)\]/gi, '')
    .trim();
};

export const ItineraryView: React.FC<ItineraryViewProps> = ({ 
  itinerary, 
  editedDayNum, 
  lastChanges = [],
  highlightedBlocks = new Set(),
  highlightedDays = new Set(),
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [activeHighlights, setActiveHighlights] = useState<Set<string>>(new Set());

  // Auto-scroll to first highlighted block after highlight is applied
  useEffect(() => {
    if (highlightedBlocks.size > 0 || highlightedDays.size > 0) {
      setActiveHighlights(highlightedBlocks);
      
      // Auto-scroll to first changed day
      const firstChangedDay = Math.min(...Array.from(highlightedDays));
      if (!isNaN(firstChangedDay)) {
        setActiveTab(firstChangedDay);
        
        // Scroll to first highlighted block in that day
        setTimeout(() => {
          const firstBlockKey = Array.from(highlightedBlocks).find(key => key.startsWith(`${firstChangedDay}-`));
          if (firstBlockKey) {
            const element = document.getElementById(`block-${firstBlockKey}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            // Scroll to day tab if no specific block
            const dayTab = document.getElementById(`day-tab-${firstChangedDay}`);
            dayTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      }
      
      // Clear highlights after 1800ms
      const timer = setTimeout(() => {
        setActiveHighlights(new Set());
      }, 1800);
      
      return () => clearTimeout(timer);
    }
    // Empty return for when there are no highlights
    return undefined;
  }, [highlightedBlocks, highlightedDays]);

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
            id={`day-tab-${idx}`}
            onClick={() => setActiveTab(idx)}
            className={`py-2 px-4 font-medium border-b-2 transition ${
              activeTab === idx
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            } ${highlightedDays.has(idx) ? 'flash-highlight' : ''} ${editedDayNum === idx + 1 ? 'bg-yellow-50' : ''}`}
          >
            {day.name}
          </button>
        ))}
      </div>

      {/* Active Day Blocks */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{activeDay.name}</h3>
        {activeDay.blocks.map((block, blockIdx) => {
          const blockKey = `${activeTab}-${blockIdx}`;
          const isHighlighted = activeHighlights.has(blockKey);
          
          return (
            <div
              key={blockIdx}
              id={`block-${blockKey}`}
              className={`p-4 border rounded-lg transition ${
                isHighlighted 
                  ? 'flash-highlight outline-2 outline-yellow-400'
                  : editedDayNum === activeTab + 1 && lastChanges.includes(block.timeOfDay)
                  ? 'bg-yellow-100 border-yellow-300'
                  : 'bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{block.timeOfDay}</h4>
                  <p className="text-slate-700 text-base">{block.title}</p>
                </div>
                {(isHighlighted || (editedDayNum === activeTab + 1 && lastChanges.includes(block.timeOfDay))) && (
                  <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded">
                    {isHighlighted ? 'Updating...' : 'Updated'}
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
                    {block.notes.map((note, idx) => {
                      const cleaned = cleanNote(note);
                      return cleaned ? (
                        <p key={idx} className="text-slate-700">
                          • {cleaned}
                        </p>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-slate-300">
                  <p className="text-xs text-slate-500">
                    Source: OpenStreetMap • Wikivoyage
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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
