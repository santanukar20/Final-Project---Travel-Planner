import { useState } from 'react';

export type IntentType = 'plan' | 'edit' | 'explain';

interface ConfirmModalProps {
  isOpen: boolean;
  transcript: string;
  onConfirm: (intent: IntentType, transcript: string) => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, transcript, onConfirm, onCancel }) => {
  const [selectedIntent, setSelectedIntent] = useState<IntentType>('plan');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedIntent, transcript);
    setSelectedIntent('plan');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
        <h3 className="text-xl font-semibold mb-3">What would you like to do?</h3>
        <p className="text-slate-600 mb-4 text-sm italic">"{transcript}"</p>

        <div className="space-y-2 mb-6">
          {(['plan', 'edit', 'explain'] as IntentType[]).map((intent) => (
            <label key={intent} className="flex items-center p-3 border rounded cursor-pointer hover:bg-slate-50"
              style={{ borderColor: selectedIntent === intent ? '#3b82f6' : '#e2e8f0' }}>
              <input
                type="radio"
                name="intent"
                value={intent}
                checked={selectedIntent === intent}
                onChange={() => setSelectedIntent(intent)}
                className="w-4 h-4"
              />
              <span className="ml-3 font-medium capitalize">{intent}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
