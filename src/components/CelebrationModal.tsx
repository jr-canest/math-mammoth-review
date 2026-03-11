import ConfettiEffect from './ConfettiEffect';

interface CelebrationModalProps {
  type: 'milestone' | 'complete';
  sectionTitle: string;
  score: number;
  onClose: () => void;
  onNextSection?: () => void;
}

export default function CelebrationModal({
  type,
  sectionTitle,
  score,
  onClose,
  onNextSection,
}: CelebrationModalProps) {
  const isMilestone = type === 'milestone';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ConfettiEffect trigger={true} intensity={isMilestone ? 'small' : 'big'} />
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-bounce-in">
        <div className="text-6xl mb-4">
          {isMilestone ? '⭐' : '🏆'}
        </div>
        <h2 className="text-2xl font-bold text-indigo-600 mb-2">
          {isMilestone ? 'Amazing Work!' : 'Section Complete!'}
        </h2>
        <p className="text-lg text-gray-700 mb-2">
          {isMilestone
            ? `You got over 80% on "${sectionTitle}"!`
            : `You completed "${sectionTitle}"!`}
        </p>
        <p className="text-3xl font-bold text-emerald-500 mb-6">
          {Math.round(score * 100)}%
        </p>
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
