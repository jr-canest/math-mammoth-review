import ConfettiEffect from './ConfettiEffect';

interface CelebrationModalProps {
  type: 'halfway' | 'milestone' | 'complete';
  sectionTitle: string;
  score: number;
  skippedCount?: number;
  onClose: () => void;
  onNextSection?: () => void;
}

export default function CelebrationModal({
  type,
  sectionTitle,
  score,
  skippedCount = 0,
  onClose,
  onNextSection,
}: CelebrationModalProps) {
  const emoji = type === 'complete' ? '🏆' : type === 'milestone' ? '⭐' : '💪';
  const heading = type === 'complete' ? 'Section Complete!' : type === 'milestone' ? 'Amazing Work!' : 'Halfway There!';
  const message = type === 'complete'
    ? `You completed "${sectionTitle}"!`
    : type === 'milestone'
    ? `You got over 80% on "${sectionTitle}"!`
    : `You're halfway through "${sectionTitle}"! Keep going!`;
  const confettiSize = type === 'complete' ? 'big' : 'small';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ConfettiEffect trigger={true} intensity={confettiSize} />
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-bounce-in">
        <div className="text-6xl mb-4">
          {emoji}
        </div>
        <h2 className="text-2xl font-bold text-indigo-600 mb-2">
          {heading}
        </h2>
        <p className="text-lg text-gray-700 mb-2">
          {message}
        </p>
        <p className="text-3xl font-bold text-emerald-500 mb-1">
          {Math.round(score * 100)}%
        </p>
        {skippedCount > 0 && (
          <p className="text-sm text-gray-400 mb-5">
            ({skippedCount} problem{skippedCount !== 1 ? 's' : ''} skipped)
          </p>
        )}
        {skippedCount === 0 && <div className="mb-6" />}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold
                       active:scale-95 transition-transform"
          >
            Keep Going
          </button>
          {onNextSection && type === 'complete' && (
            <button
              onClick={onNextSection}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold
                         active:scale-95 transition-transform"
            >
              Next Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
