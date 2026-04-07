import ConfettiEffect from './ConfettiEffect';

interface CelebrationModalProps {
  type: 'halfway' | 'milestone' | 'complete';
  sectionTitle: string;
  score: number;
  skippedCount?: number;
  onClose: () => void;
  onNextSection?: () => void;
}

/** Animated stars that pop in one by one */
function CelebrationStars({ count }: { count: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          className="w-14 h-14 text-yellow-400"
          fill="currentColor"
          viewBox="0 0 20 20"
          style={{
            animation: `star-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.25}s both`,
          }}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <style>{`
        @keyframes star-pop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function CelebrationModal({
  type,
  sectionTitle,
  score,
  skippedCount = 0,
  onClose,
  onNextSection,
}: CelebrationModalProps) {
  const starCount = type === 'complete' ? 3 : type === 'milestone' ? 2 : 1;
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
        <CelebrationStars count={starCount as 1 | 2 | 3} />
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
