interface UserSelectProps {
  onSelect: (userId: string) => void;
}

const USERS = [
  { id: 'matthias', name: 'Matthias', emoji: '🧑‍🎓' },
  { id: 'test', name: 'Test', emoji: '🧪' },
];

export default function UserSelect({ onSelect }: UserSelectProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold text-indigo-600 mb-2">Math Mammoth Review</h1>
      <p className="text-gray-500 mb-8">Who's practicing today?</p>

      <div className="flex gap-4">
        {USERS.map(user => (
          <button
            key={user.id}
            onClick={() => onSelect(user.id)}
            className="bg-white rounded-2xl shadow-md p-6 w-36 text-center
                       active:scale-95 transition-transform hover:shadow-lg"
          >
            <div className="text-4xl mb-2">{user.emoji}</div>
            <div className="text-lg font-bold text-gray-900">{user.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
