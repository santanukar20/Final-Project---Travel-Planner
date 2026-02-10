import { SessionState, EvalResult } from '@shared/types';

interface EvaluationsSectionProps {
  session: SessionState | null;
}

const renderEval = (name: string, eval_: EvalResult | null | undefined) => {
  if (!eval_) return null;

  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <h5 className="font-semibold text-slate-700 mb-1">{name}</h5>
      <p className="text-sm text-slate-600">
        <strong>Status:</strong> {eval_.passed ? '✓ Passed' : '✗ Failed'}
      </p>
      {eval_.failures && eval_.failures.length > 0 && (
        <div className="mt-2 text-xs text-red-600">
          {eval_.failures.map((failure, idx) => (
            <p key={idx}>
              ⚠ {failure.check}: {failure.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export const EvaluationsSection: React.FC<EvaluationsSectionProps> = ({ session }) => {
  const hasAnyEval = session?.evals?.feasibility || session?.evals?.editCorrectness || session?.evals?.grounding;

  if (!hasAnyEval) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-500">Evaluations will appear after planning or editing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-slate-700 mb-3">AI Evaluations</h4>
      {renderEval('Feasibility', session?.evals?.feasibility)}
      {renderEval('Grounding / Hallucination', session?.evals?.grounding)}
      {renderEval('Edit Correctness', session?.evals?.editCorrectness)}
    </div>
  );
};
