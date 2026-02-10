import { SessionState } from '@shared/types';
import { useState } from 'react';

interface SourcesSectionProps {
  session: SessionState | null;
}

export const SourcesSection: React.FC<SourcesSectionProps> = ({ session }) => {
  const [expandedPoI, setExpandedPoI] = useState<string | null>(null);

  const poiIds = Object.keys(session?.poiCatalog || {});
  const wikivoyageTips = session?.tips?.filter((t) => t.citations.some((c) => c.source === 'Wikivoyage')) || [];
  const weatherTips = session?.tips?.filter((t) => t.citations.some((c) => (c as any).source === 'Open-Meteo')) || [];

  const hasSources = poiIds.length > 0 || wikivoyageTips.length > 0 || weatherTips.length > 0;

  if (!hasSources) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-500">Sources will appear once an itinerary is generated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* POI Sources */}
      {poiIds.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">POI Sources ({poiIds.length})</h4>
          <div className="space-y-2">
            {poiIds.map((poiId) => {
              const poi = session?.poiCatalog?.[poiId];
              if (!poi) return null;
              return (
                <div key={poiId} className="p-2 bg-white rounded border border-slate-200 text-sm cursor-pointer hover:bg-blue-50"
                  onClick={() => setExpandedPoI(expandedPoI === poiId ? null : poiId)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{poi.name}</p>
                    </div>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{poi.type}</span>
                  </div>
                  {expandedPoI === poiId && (
                    <div className="mt-2 text-xs text-slate-600 border-t pt-2">
                      <p>
                        <strong>Duration:</strong> {poi.typicalDurationHours}h
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Wikivoyage Tips */}
      {wikivoyageTips.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">Wikivoyage Tips ({wikivoyageTips.length})</h4>
          <div className="space-y-1">
            {wikivoyageTips.map((tip) => (
              <div key={tip.id} className="p-2 bg-white rounded border border-slate-200 text-xs">
                <p className="text-slate-700 line-clamp-2">{tip.claim}</p>
                {tip.citations.map((c) => (
                  <p key={c.anchor || c.page} className="text-slate-500 text-xs mt-1">
                    {c.page} {c.anchor && `(${c.anchor})`}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather Info */}
      {weatherTips.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">Weather (Open-Meteo)</h4>
          <div className="space-y-1">
            {weatherTips.map((tip) => (
              <div key={tip.id} className="p-2 bg-blue-50 rounded border border-blue-200 text-xs">
                <p className="text-slate-700">{tip.claim}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
