import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

interface Level {
  id: number;
  label: string;
  variable: string;
  hint: string;
  rule: (n: number) => number;
  description: string;
  context?: string;
  dollarOutput?: boolean;
}

interface HistoryEntry {
  input: number;
  output: number;
}

interface MathMachinesProps {
  onComplete?: (score: number) => void;
}

// ─── Levels ──────────────────────────────────────────────────────────

const LEVELS: Level[] = [
  { id: 1, variable: 'n', label: 'Level 1', hint: 'The machine does one thing to your number.', rule: n => n * 2, description: 'n ⋅ 2' },
  { id: 2, variable: 'x', label: 'Level 2', hint: 'This machine adds something to your number.', rule: n => n + 7, description: 'x + 7' },
  { id: 3, variable: 'a', label: 'Level 3', hint: 'Now the machine does TWO things to your number!', rule: n => n * 3 + 1, description: '3 ⋅ a + 1' },
  { id: 4, variable: 'k', label: 'Level 4', hint: 'Two operations again — watch the pattern carefully.', rule: n => n * 2 - 5, description: '2 ⋅ k − 5' },
  { id: 5, variable: 'x', label: 'Level 5', hint: 'This one uses parentheses! Think about the distributive property.', rule: n => 3 * (n + 2), description: '3 ⋅ (x + 2)' },
  { id: 6, variable: 'b', label: 'Level 6', hint: 'Each LEGO brick costs a certain amount, plus a bag fee. What\'s the pricing rule?', rule: n => n * 4 + 2, description: '4 ⋅ b + 2', context: 'LEGO Price Calculator', dollarOutput: true },
];

// ─── Expression helpers ──────────────────────────────────────────────

function substituteTokens(tokens: string[], value: number, variable: string): string {
  return tokens.map(t => t === variable ? String(value) : t).join(' ');
}

function evaluateTokens(tokens: string[], xVal: number, variable: string): number {
  if (tokens.length === 0) return NaN;
  let expr = tokens.map(t => {
    if (t === variable) return `(${xVal})`;
    if (t === '⋅') return '*';
    if (t === '÷') return '/';
    if (t === '−') return '-';
    return t;
  }).join(' ');
  expr = expr.replace(/(\d)\s+\(/g, '$1 * (');
  expr = expr.replace(/\)\s+(\d)/g, ') * $1');
  expr = expr.replace(/\)\s+\(/g, ') * (');
  try {
    const result = new Function(`"use strict"; return (${expr})`)() as number;
    return (typeof result === 'number' && isFinite(result)) ? result : NaN;
  } catch { return NaN; }
}

function checkExpression(tokens: string[], level: Level): boolean {
  if (tokens.length === 0) return false;
  return [-3, 0, 1, 2, 5, 10, 17].every(v => {
    const r = evaluateTokens(tokens, v, level.variable);
    return !isNaN(r) && Math.abs(r - level.rule(v)) < 0.0001;
  });
}

// ─── Confetti ────────────────────────────────────────────────────────

function ConfettiParticles() {
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6'];
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 0.8, color: colors[i % colors.length], size: 5 + Math.random() * 5,
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map(p => (
        <div key={p.id} className="absolute" style={{
          left: `${p.left}%`, top: '-8px', width: p.size, height: p.size,
          backgroundColor: p.color, borderRadius: p.size > 7 ? '50%' : '2px',
          animation: `mm-confetti ${p.duration}s ease-out ${p.delay}s both`,
        }} />
      ))}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const STYLE_ID = 'math-machines-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mm-process { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
    @keyframes mm-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
    @keyframes mm-star-pop { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.3) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes mm-confetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(120px) rotate(720deg);opacity:0} }
    .mm-process { animation: mm-process 0.6s linear; }
    .mm-shake { animation: mm-shake 0.4s ease-in-out; }
    .mm-star-pop { animation: mm-star-pop 0.5s ease-out both; }
  `;
  document.head.appendChild(style);
}

// ─── Drag-and-drop expression builder ────────────────────────────────

interface DragToken {
  id: string;
  label: string;
  variant: 'variable' | 'number' | 'operator';
}

let tokenIdCounter = 0;
function makeToken(label: string, variant: DragToken['variant']): DragToken {
  return { id: `tok-${tokenIdCounter++}`, label, variant };
}

function ExpressionBuilder({
  tokens,
  onTokensChange,
  disabled,
  dropZoneRef,
  renderDropZone,
  variable,
}: {
  tokens: DragToken[];
  onTokensChange: (tokens: DragToken[] | ((prev: DragToken[]) => DragToken[])) => void;
  disabled: boolean;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  renderDropZone: (content: React.ReactNode) => React.ReactNode;
  variable: string;
}) {
  const [dragState, setDragState] = useState<{
    token: DragToken;
    sourceIndex: number | null; // null = from palette
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Insert position indicator
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const didDragRef = useRef(false); // suppress click after drag

  const chipRefs = useRef<Map<string, HTMLElement>>(new Map());

  const palette: { label: string; variant: DragToken['variant'] }[][] = [
    // Row 1: variable + operators
    [
      { label: variable, variant: 'variable' },
      ...(['+','−','⋅','÷','(',')'] as const).map(op => ({ label: op, variant: 'operator' as const })),
    ],
    // Row 2: numbers
    ['0','1','2','3','4','5','6','7','8','9'].map(n => ({ label: n, variant: 'number' as const })),
  ];

  const variantClasses = {
    variable: 'bg-indigo-100 border-indigo-300 text-indigo-700',
    number: 'bg-white border-gray-200 text-gray-800',
    operator: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  // Compute insert index from pointer position
  const computeInsertIndex = useCallback((clientX: number, clientY: number): number | null => {
    const zone = dropZoneRef.current;
    if (!zone) return null;
    const zoneRect = zone.getBoundingClientRect();
    // Outside the drop zone = remove (trash)
    if (clientY < zoneRect.top || clientY > zoneRect.bottom) return null;
    if (clientX < zoneRect.left || clientX > zoneRect.right) return null;

    // Find where to insert based on chip positions
    let bestIndex = tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      const el = chipRefs.current.get(tokens[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (clientX < midX) { bestIndex = i; break; }
    }
    return bestIndex;
  }, [tokens]);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    token: DragToken,
    sourceIndex: number | null,
  ) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    didDragRef.current = false;
    setDragState({
      token,
      sourceIndex,
      offsetX: 0, offsetY: 0,
      currentX: e.clientX, currentY: e.clientY,
    });
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    e.preventDefault();
    didDragRef.current = true;
    const newState = { ...dragState, currentX: e.clientX, currentY: e.clientY };
    setDragState(newState);

    const idx = computeInsertIndex(e.clientX, e.clientY);
    setInsertIndex(idx);
    setOverTrash(idx === null);
  }, [dragState, computeInsertIndex]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    e.preventDefault();

    const idx = computeInsertIndex(e.clientX, e.clientY);

    if (idx === null) {
      // Dragged out of zone — remove if it was from the expression
      if (dragState.sourceIndex !== null) {
        const newTokens = tokens.filter((_, i) => i !== dragState.sourceIndex);
        onTokensChange(newTokens);
      }
    } else {
      if (dragState.sourceIndex !== null) {
        // Rearranging within expression
        const newTokens = [...tokens];
        const [removed] = newTokens.splice(dragState.sourceIndex, 1);
        const adjustedIdx = idx > dragState.sourceIndex ? idx - 1 : idx;
        newTokens.splice(adjustedIdx, 0, removed);
        onTokensChange(newTokens);
      } else {
        // Dragging from palette — insert new token
        const newToken = makeToken(dragState.token.label, dragState.token.variant);
        const newTokens = [...tokens];
        newTokens.splice(idx, 0, newToken);
        onTokensChange(newTokens);
      }
    }

    setDragState(null);
    setInsertIndex(null);
    setOverTrash(false);
  }, [dragState, tokens, onTokensChange, computeInsertIndex]);

  // Also support tap-to-add for quick entry (suppressed if drag just happened)
  const handleTap = useCallback((label: string, variant: DragToken['variant']) => {
    if (disabled || didDragRef.current) return;
    const newToken = makeToken(label, variant);
    onTokensChange(prev => [...prev, newToken]);
  }, [disabled, onTokensChange]);

  const handleRemoveLast = useCallback(() => {
    onTokensChange(prev => prev.slice(0, -1));
  }, [onTokensChange]);

  const handleClear = useCallback(() => {
    onTokensChange([]);
  }, [onTokensChange]);

  // Render a chip (used in palette and drop zone)
  const renderChip = (label: string, variant: DragToken['variant'], isDragging = false) => (
    <span className={`inline-flex items-center justify-center rounded-lg border-2 font-bold font-mono text-base select-none
      ${variantClasses[variant]} ${isDragging ? 'opacity-50 scale-90' : 'shadow-sm'}`}
      style={{ minWidth: 38, minHeight: 38, padding: '4px 10px' }}
    >
      {label}
    </span>
  );

  // Token chips to render inside the drop zone
  const dropZoneChips = (
    <>
      {tokens.map((tok, i) => {
        const isBeingDragged = dragState?.sourceIndex === i;
        return (
          <span key={tok.id} style={{ position: 'relative' }}>
            {insertIndex === i && dragState && (
              <span className="absolute -left-1 top-0 bottom-0 w-0.5 bg-indigo-500 rounded-full" />
            )}
            <span
              ref={el => { if (el) chipRefs.current.set(tok.id, el); else chipRefs.current.delete(tok.id); }}
              onPointerDown={e => handlePointerDown(e, tok, i)}
              style={{ cursor: disabled ? 'default' : 'grab', touchAction: 'none' }}
              className={isBeingDragged ? 'opacity-30' : ''}
            >
              {renderChip(tok.label, tok.variant, isBeingDragged)}
            </span>
          </span>
        );
      })}
      {insertIndex === tokens.length && dragState && tokens.length > 0 && (
        <span className="w-0.5 h-9 bg-indigo-500 rounded-full" />
      )}
    </>
  );

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="touch-none"
    >
      {/* Drop zone rendered by parent (in the machine center) */}
      {renderDropZone(dropZoneChips)}

      {/* Palette — tap or drag from here */}
      <div className="flex items-center justify-between mb-2 mt-3">
        <p className="text-sm font-semibold text-gray-700">Build the rule:</p>
        {tokens.length > 0 && (
          <div className="flex gap-1">
            <button onClick={handleRemoveLast}
              className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold active:scale-90 transition-transform">⌫</button>
            <button onClick={handleClear}
              className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold active:scale-90 transition-transform">Clear</button>
          </div>
        )}
      </div>

      {palette.map((row, ri) => (
        <div key={ri} className="flex flex-wrap gap-1.5 mb-1.5">
          {row.map(p => (
            <button
              key={p.label}
              onClick={() => handleTap(p.label, p.variant)}
              onPointerDown={e => handlePointerDown(e, makeToken(p.label, p.variant), null)}
              className="touch-none"
              style={{ cursor: disabled ? 'default' : 'grab' }}
              disabled={disabled}
            >
              {renderChip(p.label, p.variant)}
            </button>
          ))}
        </div>
      ))}

      {/* Drag ghost */}
      {dragState && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragState.currentX - 20,
            top: dragState.currentY - 20,
            transform: overTrash ? 'scale(0.7)' : 'scale(1.1)',
            opacity: overTrash ? 0.5 : 1,
            transition: 'transform 0.1s, opacity 0.1s',
          }}
        >
          {renderChip(dragState.token.label, dragState.token.variant)}
          {overTrash && (
            <span className="absolute -top-1 -right-1 text-red-500 text-xs font-bold">✕</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function MathMachines({ onComplete }: MathMachinesProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [expressionTokens, setExpressionTokens] = useState<DragToken[]>([]);
  const [guessAttempts, setGuessAttempts] = useState(0);
  const [totalGuesses, setTotalGuesses] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [levelComplete, setLevelComplete] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const machineDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ensureStyles(); }, []);

  const level = LEVELS[currentLevel];
  const canGuess = history.length >= 3;
  const tokenLabels = expressionTokens.map(t => t.label);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleFeed = useCallback(() => {
    const num = parseFloat(inputValue);
    if (isNaN(num) || animating) return;
    setAnimating(true);
    setInputValue('');

    const output = level.rule(num);
    setTimeout(() => {

      setHistory(prev => [...prev, { input: num, output }]);
      setAnimating(false);
      setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, 800);
  }, [inputValue, animating, level]);

  const handleCheck = useCallback(() => {
    if (tokenLabels.length === 0) return;
    const isCorrect = checkExpression(tokenLabels, level);
    setGuessAttempts(prev => prev + 1);
    if (isCorrect) {
      setFeedback('correct');
      setShowConfetti(true);
      setLevelComplete(true);
      setTotalGuesses(prev => [...prev, guessAttempts + 1]);
      setTimeout(() => setShowConfetti(false), 2500);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 1500);
    }
  }, [tokenLabels, level, guessAttempts]);

  const handleNextLevel = useCallback(() => {
    if (currentLevel + 1 >= LEVELS.length) {
      setGameComplete(true);
      const ag = [...totalGuesses];
      const avg = ag.reduce((a, b) => a + b, 0) / ag.length;
      onComplete?.(avg <= 2 ? 3 : avg <= 3 ? 2 : 1);
      return;
    }
    setCurrentLevel(prev => prev + 1);
    setHistory([]);
    setExpressionTokens([]);
    setGuessAttempts(0);
    setFeedback(null);
    setLevelComplete(false);

    setShowConfetti(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentLevel, totalGuesses, onComplete]);

  const handlePlayAgain = useCallback(() => {
    setCurrentLevel(0); setHistory([]); setInputValue('');
    setExpressionTokens([]); setGuessAttempts(0); setTotalGuesses([]);
    setFeedback(null); setLevelComplete(false); setGameComplete(false);
    setShowConfetti(false); setAnimating(false);
  }, []);

  const avgGuesses = totalGuesses.length > 0
    ? totalGuesses.reduce((a, b) => a + b, 0) / totalGuesses.length : 0;
  const stars = avgGuesses <= 2 ? 3 : avgGuesses <= 3 ? 2 : 1;

  // ─── Game Complete ─────────────────────────────────────────────────
  if (gameComplete) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4 relative">
        <ConfettiParticles />
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center relative z-5">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Levels Complete!</h2>
          <p className="text-gray-500 text-sm mb-6">You cracked all 6 Math Machines</p>
          <div className="flex justify-center gap-2 mb-4">
            {[1,2,3].map(i => (
              <span key={i} className="mm-star-pop text-4xl" style={{
                animationDelay: `${i*0.2}s`, filter: i <= stars ? 'none' : 'grayscale(1) opacity(0.3)',
              }}>⭐</span>
            ))}
          </div>
          <p className="text-gray-700 mb-2">
            Average guesses: <strong className="text-indigo-600">{avgGuesses.toFixed(1)}</strong>
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {totalGuesses.map((g, i) => (
              <span key={i} className={`text-xs font-mono px-2 py-1 rounded-lg ${
                g <= 2 ? 'bg-emerald-50 text-emerald-600' : g <= 3 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
              }`}>L{i+1}: {g}</span>
            ))}
          </div>
          <button onClick={handlePlayAgain}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Game ─────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-4">

        {/* Level dots */}
        <div className="flex justify-center gap-2.5 mb-4">
          {LEVELS.map((_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${
              i < currentLevel ? 'bg-emerald-500' : i === currentLevel ? 'bg-indigo-600 ring-2 ring-indigo-200' : 'bg-gray-300'
            }`} />
          ))}
        </div>

        {/* Level header + hint */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{level.context ? '🧱' : '⚙️'}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{level.context || level.label}</h2>
              <p className="text-xs text-gray-400">{level.label}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">{level.hint}</p>
          <p className="text-xs text-gray-400 mt-1">💡 Try small numbers like 0, 1, 2, 3, 5, or 10.</p>
        </div>

        {/* ═══ Machine + Expression Builder (unified card) ═══ */}
        {canGuess && !levelComplete ? (
          <div className={`relative bg-white rounded-2xl shadow-sm px-3 py-3 mb-3 overflow-hidden ${feedback === 'wrong' ? 'mm-shake' : ''}`}>
            {showConfetti && <ConfettiParticles />}
            <ExpressionBuilder
              tokens={expressionTokens}
              onTokensChange={setExpressionTokens}
              disabled={false}
              dropZoneRef={machineDropRef}
              variable={level.variable}
              renderDropZone={(chips) => (
                <>
                  {/* Machine row: input → rule (drop zone) → output label */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-500">{level.variable} =</span>
                        <input
                          ref={inputRef}
                          type="number" inputMode="numeric"
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleFeed(); }}
                          placeholder="?"
                          disabled={animating}
                          className="w-24 bg-slate-50 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-center font-mono text-sm text-gray-800 focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          onClick={handleFeed}
                          disabled={animating || !inputValue}
                          className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 whitespace-nowrap ${
                            animating || !inputValue ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white'
                          }`}
                        >→</button>
                      </div>
                    </div>

                    {/* Machine center = drop zone */}
                    <div
                      ref={machineDropRef}
                      className={`flex-1 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border-2 py-2 px-3 min-h-[48px] transition-all ${
                        feedback === 'wrong'
                          ? 'border-red-300 bg-red-50'
                          : expressionTokens.length > 0
                            ? 'border-indigo-200 bg-indigo-50/50'
                            : 'border-dashed border-indigo-300 bg-indigo-50/30'
                      }`}
                    >
                      {expressionTokens.length > 0 ? chips : (
                        <span className="text-indigo-400 text-xs font-medium">Drag tiles here</span>
                      )}
                    </div>

                    <span className="text-gray-400 text-[10px] font-bold uppercase shrink-0">Output</span>
                  </div>
                </>
              )}
            />
            <button
              onClick={handleCheck}
              disabled={tokenLabels.length === 0}
              className={`w-full py-3 mt-3 rounded-xl font-bold text-base transition-all active:scale-95 ${
                tokenLabels.length > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}
            >
              Check My Rule ✓
            </button>
            {feedback === 'wrong' && (
              <p className="text-red-500 text-sm mt-2 text-center font-medium">
                Not quite — try changing your expression or testing more numbers!
              </p>
            )}
          </div>
        ) : (
          <div className="relative bg-white rounded-2xl shadow-sm px-3 py-3 mb-3 overflow-hidden">
            {showConfetti && <ConfettiParticles />}
            <div className="flex items-center gap-1.5">
              <div className="shrink-0">
                {!levelComplete ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-500">{level.variable} =</span>
                    <input
                      ref={inputRef}
                      type="number" inputMode="numeric"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleFeed(); }}
                      placeholder="?"
                      disabled={animating}
                      className="w-24 bg-slate-50 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-center font-mono text-sm text-gray-800 focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                      onClick={handleFeed}
                      disabled={animating || !inputValue}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 whitespace-nowrap ${
                        animating || !inputValue ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white'
                      }`}
                    >→</button>
                  </div>
                ) : (
                  <span className="text-gray-300 font-mono text-sm">{level.variable} = —</span>
                )}
              </div>

              <div className={`flex-1 flex items-center justify-center rounded-xl border-2 py-2 px-3 min-h-[48px] transition-all ${
                levelComplete ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
              }`}>
                {animating ? (
                  <span className="mm-process inline-block text-xl">⚙️</span>
                ) : levelComplete ? (
                  <span className="font-mono text-sm font-bold text-emerald-700">{level.description}</span>
                ) : (
                  <span className="text-gray-400 font-bold text-sm tracking-wider">? ? ?</span>
                )}
              </div>

              <span className="text-gray-400 text-[10px] font-bold uppercase shrink-0">Output</span>
            </div>
          </div>
        )}

        {/* Hint before enough tests */}
        {history.length > 0 && history.length < 3 && !levelComplete && (
          <div className="bg-amber-50 rounded-2xl p-3 mb-4 text-center">
            <p className="text-amber-700 text-sm font-medium">
              Feed {3 - history.length} more number{3 - history.length > 1 ? 's' : ''} to start building your rule
            </p>
          </div>
        )}

        {/* ═══ History table ═══ */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="grid grid-cols-3 bg-indigo-50 border-b border-indigo-100">
              <div className="px-3 py-2 text-xs font-bold text-indigo-500 uppercase">Input</div>
              <div className="px-3 py-2 text-xs font-bold text-indigo-500 uppercase text-center">
                {tokenLabels.length > 0 ? 'Expression' : 'Rule'}
              </div>
              <div className="px-3 py-2 text-xs font-bold text-indigo-500 uppercase text-right">Output</div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {history.map((entry, i) => {
                const has = tokenLabels.length > 0;
                const sub = has ? substituteTokens(tokenLabels, entry.input, level.variable) : '???';
                const ev = has ? evaluateTokens(tokenLabels, entry.input, level.variable) : NaN;
                const match = has && !isNaN(ev) && Math.abs(ev - entry.output) < 0.0001;
                const outStr = level.dollarOutput ? `$${entry.output}` : String(entry.output);
                return (
                  <div key={i} className="grid grid-cols-3 items-center">
                    <div className="px-3 py-2.5 font-mono text-sm text-gray-700">{level.variable} = {entry.input}</div>
                    <div className={`px-3 py-2.5 font-mono text-xs text-center ${
                      has ? match ? 'text-emerald-600' : 'text-red-400' : 'text-gray-400'
                    }`}>{sub}</div>
                    <div className="px-3 py-2.5 text-right">
                      <span className={`font-mono text-sm font-bold ${
                        has && match ? 'text-emerald-600' : 'text-indigo-600'
                      }`}>{has && match ? '= ' : ''}{outStr}</span>
                      {has && match && <span className="ml-1 text-emerald-500">✓</span>}
                      {has && !isNaN(ev) && !match && (
                        <span className="ml-1 text-red-400 text-xs">(≠ {Math.round(ev*100)/100})</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={historyEndRef} />
            </div>
          </div>
        )}

        {/* Level complete */}
        {levelComplete && (
          <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-emerald-700 text-lg font-bold mb-1">You got it!</p>
            <p className="font-mono text-sm text-gray-700 mb-1">
              The rule was: <strong className="text-indigo-700">{level.description}</strong>
            </p>
            <p className="text-gray-500 text-xs mb-4">
              Solved in {guessAttempts} {guessAttempts === 1 ? 'guess' : 'guesses'}
            </p>
            <button onClick={handleNextLevel}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
              {currentLevel + 1 >= LEVELS.length ? 'See Results →' : 'Next Level →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
