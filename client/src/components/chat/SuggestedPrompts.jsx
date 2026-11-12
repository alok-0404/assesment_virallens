export const SUGGESTED_PROMPTS = [
  'Where is my order and how can I track it?',
  'How do I return an item and get a refund?',
  'I was charged twice for the same order.',
  'How can I change my shipping address?',
];

export default function SuggestedPrompts({ onSelect, disabled }) {
  return (
    <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
