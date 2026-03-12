import { useState, useRef, useEffect } from 'react';

interface UserSelectProps {
  onSelect: (userId: string) => void;
}

const USERS = [
  { id: 'matthias', name: 'Matthias', emoji: '🧑‍🎓', pin: '1234' },
  { id: 'test', name: 'Test', emoji: '🧪' },
] as const;

type User = (typeof USERS)[number];

export default function UserSelect({ onSelect }: UserSelectProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedUser && 'pin' in selectedUser) {
      pinRef.current?.focus();
    }
  }, [selectedUser]);

  const handleUserClick = (user: User) => {
    if ('pin' in user && user.pin) {
      setSelectedUser(user);
      setPin('');
      setError(false);
    } else {
      onSelect(user.id);
    }
  };

  const handlePinSubmit = () => {
    if (!selectedUser || !('pin' in selectedUser)) return;
    if (pin === selectedUser.pin) {
      onSelect(selectedUser.id);
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setPin('');
      pinRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold text-indigo-600 mb-2">Math Mammoth Review</h1>
      <p className="text-gray-500 mb-8">Who's practicing today?</p>

      {!selectedUser ? (
        <div className="flex gap-4">
          {USERS.map(user => (
            <button
              key={user.id}
              onClick={() => handleUserClick(user)}
              className="bg-white rounded-2xl shadow-md p-6 w-36 text-center
                         active:scale-95 transition-transform hover:shadow-lg"
            >
              <div className="text-4xl mb-2">{user.emoji}</div>
              <div className="text-lg font-bold text-gray-900">{user.name}</div>
              {'pin' in user && (
                <div className="text-xs text-gray-400 mt-1">🔒</div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-xs w-full">
          <div className="text-4xl mb-2">{selectedUser.emoji}</div>
          <div className="text-lg font-bold text-gray-900 mb-4">{selectedUser.name}</div>
          <p className="text-sm text-gray-500 mb-3">Enter your PIN</p>
          <div className={shaking ? 'animate-shake' : ''}>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
                setError(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handlePinSubmit();
              }}
              placeholder="• • • •"
              className={`w-32 mx-auto block text-center text-2xl tracking-[0.5em] px-3 py-2 rounded-lg border-2
                         focus:outline-none transition-colors
                         ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-indigo-400'}`}
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-2">Wrong PIN</p>
          )}
          <div className="flex gap-3 justify-center mt-5">
            <button
              onClick={() => { setSelectedUser(null); setPin(''); setError(false); }}
              className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg
                         active:scale-95 transition-transform"
            >
              Back
            </button>
            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4}
              className="px-5 py-2 text-sm text-white bg-indigo-600 rounded-lg font-semibold
                         disabled:opacity-40 active:scale-95 transition-transform"
            >
              Enter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
