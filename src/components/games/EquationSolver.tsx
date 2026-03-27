import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

interface Term {
  coefficient: number;
  variable: boolean;
}

interface EquationState {
  left: Term[];
  right: Term[];
}

interface DistributiveForm {
  factor: number;
  innerConst: number;
  otherSide: number;
}

interface QuotientForm {
  divisor: number;
  innerConst: number; // e.g. −4 for (n − 4)/3
  otherSide: number;
  expandedLeft: EquationState; // state after multiplying by divisor
}

interface WordProblem {
  id: number;
  text: string;
  correctEquation: string;
  distractors: string[];
  initial: EquationState;
  solution: number;
  category: 'one-step' | 'two-step' | 'distributive';
  distributive?: DistributiveForm;
  quotient?: QuotientForm;
}

interface ProblemResult {
  phase1Attempts: number;
  hintUsed: boolean;
  steps: number;
}

type OpType = '+' | '−' | '×' | '÷';
type GamePhase = 'pick-equation' | 'solve-equation' | 'problem-complete' | 'game-complete';

interface EquationSolverProps {
  onComplete?: (score: number) => void;
}

// ─── Problem Data ────────────────────────────────────────────────────

const PROBLEMS: WordProblem[] = [
  // 4 one-step
  {
    id: 1, category: 'one-step',
    text: "I'm thinking of a number. Add 9 and you get 21.",
    correctEquation: 'n + 9 = 21',
    distractors: ['n − 9 = 21', '9n = 21', 'n + 21 = 9'],
    initial: { left: [{ coefficient: 1, variable: true }, { coefficient: 9, variable: false }], right: [{ coefficient: 21, variable: false }] },
    solution: 12,
  },
  {
    id: 2, category: 'one-step',
    text: "A LEGO minifigure costs $n. You buy one and get $3.50 change from $10.",
    correctEquation: '10 − n = 3.5',
    distractors: ['n − 10 = 3.5', 'n + 10 = 3.5', '10 + n = 3.5'],
    initial: { left: [{ coefficient: -1, variable: true }, { coefficient: 10, variable: false }], right: [{ coefficient: 3.5, variable: false }] },
    solution: 6.5,
  },
  {
    id: 3, category: 'one-step',
    text: "Triple a number and you get 45.",
    correctEquation: '3n = 45',
    distractors: ['n + 3 = 45', '3 + n = 45', 'n ÷ 3 = 45'],
    initial: { left: [{ coefficient: 3, variable: true }], right: [{ coefficient: 45, variable: false }] },
    solution: 15,
  },
  {
    id: 4, category: 'one-step',
    text: "A hockey player scored n goals. After scoring 6 more, he has 19.",
    correctEquation: 'n + 6 = 19',
    distractors: ['n − 6 = 19', '6n = 19', 'n + 19 = 6'],
    initial: { left: [{ coefficient: 1, variable: true }, { coefficient: 6, variable: false }], right: [{ coefficient: 19, variable: false }] },
    solution: 13,
  },
  // 5 two-step
  {
    id: 5, category: 'two-step',
    text: "I'm thinking of a number. Triple it and subtract 4. You get 11.",
    correctEquation: '3n − 4 = 11',
    distractors: ['3n + 4 = 11', 'n − 4 = 11', '3(n − 4) = 11'],
    initial: { left: [{ coefficient: 3, variable: true }, { coefficient: -4, variable: false }], right: [{ coefficient: 11, variable: false }] },
    solution: 5,
  },
  {
    id: 6, category: 'two-step',
    text: "A LEGO set costs $n. Buy 3 and pay $6 shipping. Total is $45.",
    correctEquation: '3n + 6 = 45',
    distractors: ['3n − 6 = 45', '3(n + 6) = 45', '6n + 3 = 45'],
    initial: { left: [{ coefficient: 3, variable: true }, { coefficient: 6, variable: false }], right: [{ coefficient: 45, variable: false }] },
    solution: 13,
  },
  {
    id: 7, category: 'two-step',
    text: "A bag of bricks costs $n. Buy 4 bags and use a $5 coupon. You pay $35.",
    correctEquation: '4n − 5 = 35',
    distractors: ['4n + 5 = 35', '5n − 4 = 35', '4(n − 5) = 35'],
    initial: { left: [{ coefficient: 4, variable: true }, { coefficient: -5, variable: false }], right: [{ coefficient: 35, variable: false }] },
    solution: 10,
  },
  {
    id: 8, category: 'two-step',
    text: "Take a number, divide by 3, then add 2. You get 8.",
    correctEquation: 'n/3 + 2 = 8',
    distractors: ['3n + 2 = 8', 'n/3 − 2 = 8', 'n + 2/3 = 8'],
    initial: { left: [{ coefficient: 1 / 3, variable: true }, { coefficient: 2, variable: false }], right: [{ coefficient: 8, variable: false }] },
    solution: 18,
  },
  {
    id: 9, category: 'two-step',
    text: "A hockey team has n players. 4 are injured. The remaining are split into 3 equal lines of 6.",
    correctEquation: '(n − 4) / 3 = 6',
    distractors: ['(n + 4) / 3 = 6', 'n/3 − 4 = 6', '(n − 3) / 4 = 6'],
    initial: { left: [{ coefficient: 1, variable: true }, { coefficient: -4, variable: false }], right: [{ coefficient: 18, variable: false }] },
    solution: 22,
    quotient: {
      divisor: 3,
      innerConst: -4,
      otherSide: 6,
      expandedLeft: { left: [{ coefficient: 1, variable: true }, { coefficient: -4, variable: false }], right: [{ coefficient: 18, variable: false }] },
    },
  },
  // 3 distributive
  {
    id: 10, category: 'distributive',
    text: "Buy 3 LEGO sets that each cost $n plus a $2 bag fee per set. Total is $36.",
    correctEquation: '3(n + 2) = 36',
    distractors: ['3n + 2 = 36', '3(n − 2) = 36', '2(n + 3) = 36'],
    initial: { left: [{ coefficient: 3, variable: true }, { coefficient: 6, variable: false }], right: [{ coefficient: 36, variable: false }] },
    solution: 10,
    distributive: { factor: 3, innerConst: 2, otherSide: 36 },
  },
  {
    id: 11, category: 'distributive',
    text: "You and 4 friends each pay for a ticket ($n) and a $3 snack. The group total is $60.",
    correctEquation: '5(n + 3) = 60',
    distractors: ['5n + 3 = 60', '5(n − 3) = 60', '3(n + 5) = 60'],
    initial: { left: [{ coefficient: 5, variable: true }, { coefficient: 15, variable: false }], right: [{ coefficient: 60, variable: false }] },
    solution: 9,
    distributive: { factor: 5, innerConst: 3, otherSide: 60 },
  },
  {
    id: 12, category: 'distributive',
    text: "There are 4 shelves. Each has n books plus 3 extra stacked on top. Total books: 52.",
    correctEquation: '4(n + 3) = 52',
    distractors: ['4n + 3 = 52', '4(n − 3) = 52', '3(n + 4) = 52'],
    initial: { left: [{ coefficient: 4, variable: true }, { coefficient: 12, variable: false }], right: [{ coefficient: 52, variable: false }] },
    solution: 10,
    distributive: { factor: 4, innerConst: 3, otherSide: 52 },
  },
];

// ─── Equation Engine ─────────────────────────────────────────────────

function normalize(eq: EquationState): EquationState {
  const normSide = (terms: Term[]): Term[] => {
    let vc = 0, cc = 0;
    for (const t of terms) {
      if (t.variable) vc += t.coefficient;
      else cc += t.coefficient;
    }
    const r: Term[] = [];
    if (Math.abs(vc) > 1e-9) r.push({ coefficient: vc, variable: true });
    if (Math.abs(cc) > 1e-9) r.push({ coefficient: cc, variable: false });
    if (r.length === 0) r.push({ coefficient: 0, variable: false });
    return r;
  };
  return { left: normSide(eq.left), right: normSide(eq.right) };
}

function applyOp(eq: EquationState, op: OpType, value: number): EquationState {
  const apply = (terms: Term[]): Term[] => {
    switch (op) {
      case '+': return [...terms, { coefficient: value, variable: false }];
      case '−': return [...terms, { coefficient: -value, variable: false }];
      case '×': return terms.map(t => ({ ...t, coefficient: t.coefficient * value }));
      case '÷': return terms.map(t => ({ ...t, coefficient: t.coefficient / value }));
    }
  };
  return normalize({ left: apply(eq.left), right: apply(eq.right) });
}

function isSolved(eq: EquationState): { solved: boolean; value?: number } {
  const { left, right } = eq;
  // n = value
  if (left.length === 1 && left[0].variable && Math.abs(left[0].coefficient - 1) < 1e-9
    && right.length === 1 && !right[0].variable) {
    return { solved: true, value: right[0].coefficient };
  }
  // value = n
  if (right.length === 1 && right[0].variable && Math.abs(right[0].coefficient - 1) < 1e-9
    && left.length === 1 && !left[0].variable) {
    return { solved: true, value: left[0].coefficient };
  }
  return { solved: false };
}

function termToString(t: Term): string {
  if (t.variable) {
    const c = t.coefficient;
    if (Math.abs(c - 1) < 1e-9) return 'n';
    if (Math.abs(c + 1) < 1e-9) return '−n';
    // Check for clean fraction 1/k
    if (Math.abs(c) < 1 && Math.abs(c) > 1e-9) {
      const denom = Math.round(1 / Math.abs(c));
      if (Math.abs(c * denom - (c > 0 ? 1 : -1)) < 1e-9) {
        return c > 0 ? `n/${denom}` : `−n/${denom}`;
      }
    }
    return `${cleanNum(c)}n`;
  }
  return cleanNum(t.coefficient);
}

function cleanNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Clean decimal
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function sideToString(terms: Term[]): string {
  if (terms.length === 0) return '0';
  let s = '';
  for (let i = 0; i < terms.length; i++) {
    const ts = termToString(terms[i]);
    if (i === 0) {
      s += ts;
    } else if (terms[i].coefficient < 0) {
      s += ` − ${ts.replace('−', '')}`;
    } else {
      s += ` + ${ts}`;
    }
  }
  return s;
}

function eqToString(eq: EquationState): string {
  return `${sideToString(eq.left)} = ${sideToString(eq.right)}`;
}

function getHintTarget(eq: EquationState, isDistributive: boolean, isQuotient: boolean, expanded: boolean): { blockId: string; text: string } | { text: string } {
  if ((isDistributive || isQuotient) && !expanded) return { text: 'Tap the grouped block to expand it!' };

  const { left, right } = eq;
  const varOnLeft = left.some(t => t.variable);
  const varSide = varOnLeft ? left : right;
  const sideName = varOnLeft ? 'left' : 'right';

  // Constant on variable side → drag it to the other side
  const constIdx = varSide.findIndex(t => !t.variable);
  if (constIdx !== -1 && Math.abs(varSide[constIdx].coefficient) > 1e-9) {
    return { blockId: `${sideName}-${constIdx}`, text: `Drag the ${cleanNum(varSide[constIdx].coefficient)} block to the other side` };
  }

  // Variable coefficient ≠ 1
  const varIdx = varSide.findIndex(t => t.variable);
  if (varIdx !== -1) {
    const c = varSide[varIdx].coefficient;
    if (Math.abs(c + 1) < 1e-9) {
      return { blockId: `${sideName}-${varIdx}neg`, text: 'Drag the − sign to the other side to flip it' };
    }
    if (Math.abs(c) >= 1 && Math.abs(c - 1) > 1e-9) {
      return { blockId: `${sideName}-${varIdx}c`, text: `Drag the ${cleanNum(c)} to the other side` };
    }
    if (Math.abs(c) < 1) {
      const denom = Math.round(1 / Math.abs(c));
      return { blockId: `${sideName}-${varIdx}d`, text: `Drag the ÷${denom} to the other side` };
    }
  }

  return { text: "You're almost there!" };
}

// ─── Styles ──────────────────────────────────────────────────────────

const STYLE_ID = 'equation-solver-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes es-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
    @keyframes es-pop { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
    @keyframes es-wobble { 0%{transform:rotate(0)} 25%{transform:rotate(2deg)} 50%{transform:rotate(0)} 75%{transform:rotate(-2deg)} 100%{transform:rotate(0)} }
    @keyframes es-flash { 0%{background-color:rgba(99,102,241,0.2)} 100%{background-color:transparent} }
    @keyframes es-confetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(120px) rotate(720deg);opacity:0} }
    @keyframes es-star-pop { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.3) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
    .es-shake { animation: es-shake 0.4s ease-in-out; }
    .es-pop { animation: es-pop 0.3s ease-out; }
    .es-wobble { animation: es-wobble 0.5s ease-in-out; }
    .es-flash { animation: es-flash 0.6s ease-out; }
    .es-star-pop { animation: es-star-pop 0.5s ease-out both; }
  `;
  document.head.appendChild(style);
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
          animation: `es-confetti ${p.duration}s ease-out ${p.delay}s both`,
        }} />
      ))}
    </div>
  );
}

// ─── Visual Block Model ──────────────────────────────────────────────

interface VisualBlock {
  id: string;
  label: string;
  draggable: boolean;
  action: { type: 'move'; value: number } | { type: 'divide'; value: number } | { type: 'multiply'; value: number } | { type: 'negate' } | null;
  isVariable?: boolean;
  isGrouped?: boolean; // visually adjacent to next/prev block (multiplicative)
}

function deriveBlocks(terms: Term[], side: 'left' | 'right'): VisualBlock[] {
  const blocks: VisualBlock[] = [];
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const id = `${side}-${i}`;
    if (t.variable) {
      const c = t.coefficient;
      if (Math.abs(c - 1) < 1e-9) {
        // bare n — not draggable
        blocks.push({ id, label: 'n', draggable: false, action: null, isVariable: true });
      } else if (Math.abs(c + 1) < 1e-9) {
        // −n: show [−] [n], drag the minus to negate
        blocks.push({ id: id + 'neg', label: '−', draggable: true, action: { type: 'negate' }, isGrouped: true });
        blocks.push({ id, label: 'n', draggable: false, action: null, isVariable: true, isGrouped: true });
      } else if (Math.abs(c) >= 1) {
        // 3n or -3n: show [3] [n] or [−3] [n]
        blocks.push({ id: id + 'c', label: cleanNum(c), draggable: true, action: { type: 'divide', value: c }, isGrouped: true });
        blocks.push({ id, label: 'n', draggable: false, action: null, isVariable: true, isGrouped: true });
      } else {
        // n/3: show [n] [÷3]
        const denom = Math.round(1 / Math.abs(c));
        blocks.push({ id, label: 'n', draggable: false, action: null, isVariable: true, isGrouped: true });
        blocks.push({ id: id + 'd', label: `÷${denom}`, draggable: true, action: { type: 'multiply', value: denom }, isGrouped: true });
      }
    } else {
      // Constant term — draggable, moves to other side
      blocks.push({ id, label: cleanNum(t.coefficient), draggable: true, action: { type: 'move', value: t.coefficient } });
    }
  }
  return blocks;
}

// ─── Drag Balance Scale ──────────────────────────────────────────────

interface StepAnimation {
  targetSide: 'left' | 'right';
  label: string; // e.g. "− 15" or "÷ 5"
}

function DragBalanceScale({ equation, wobble, distributive, quotient, expanded, onDrop, onExpand, hintBlockId, interactive, stepAnim, expandStep }: {
  equation: EquationState;
  wobble: boolean;
  distributive?: DistributiveForm;
  quotient?: QuotientForm;
  expanded: boolean;
  onDrop: (action: VisualBlock['action'], fromSide: 'left' | 'right') => void;
  onExpand: () => void;
  hintBlockId?: string | null;
  interactive: boolean;
  stepAnim?: StepAnimation | null;
  expandStep?: string | null;
}) {
  const [drag, setDrag] = useState<{ block: VisualBlock; fromSide: 'left' | 'right'; x: number; y: number } | null>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const showDist = distributive && !expanded;
  const showQuot = quotient && !expanded;
  const showGrouped = showDist || showQuot;
  const leftBlocks = showGrouped ? [] : deriveBlocks(equation.left, 'left');
  const rightBlocks = showGrouped ? [] : deriveBlocks(equation.right, 'right');

  const isOverTarget = (x: number, y: number): boolean => {
    if (!drag) return false;
    const targetRef = drag.fromSide === 'left' ? rightRef : leftRef;
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const didDragRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent, block: VisualBlock, fromSide: 'left' | 'right') => {
    if (!interactive || !block.draggable || !block.action) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    didDragRef.current = false;
    setDrag({ block, fromSide, x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    didDragRef.current = true;
    setDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    if (didDragRef.current && isOverTarget(e.clientX, e.clientY)) {
      onDrop(drag.block.action, drag.fromSide);
    }
    setDrag(null);
  };

  const overTarget = drag ? isOverTarget(drag.x, drag.y) : false;

  const renderBlock = (b: VisualBlock, side: 'left' | 'right') => {
    const isDragging = drag?.block.id === b.id;
    const isHint = hintBlockId === b.id;
    return (
      <span
        key={b.id}
        onPointerDown={(e) => handlePointerDown(e, b, side)}
        onClick={() => { if (interactive && b.draggable && b.action && !didDragRef.current) onDrop(b.action, side); }}
        className={`inline-flex items-center justify-center rounded-lg border-2 font-bold font-mono text-sm px-2.5 py-1.5 select-none transition-all touch-none
          ${isDragging ? 'opacity-30 scale-90' : ''}
          ${isHint ? 'ring-2 ring-amber-400 ring-offset-1 animate-pulse' : ''}
          ${b.draggable && interactive ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'}
          ${b.isVariable ? 'bg-indigo-100 border-indigo-300 text-indigo-700' :
            b.draggable ? 'bg-white border-gray-300 text-gray-800 shadow-sm' :
              'bg-gray-50 border-gray-200 text-gray-500'}`}
        style={{ minWidth: 36, minHeight: 36 }}
      >
        {b.label}
      </span>
    );
  };

  const renderSideBlocks = (blocks: VisualBlock[], side: 'left' | 'right') => {
    // Split blocks into "terms" — a group (multiplicative) or a single constant
    const termGroups: VisualBlock[][] = [];
    let i = 0;
    while (i < blocks.length) {
      if (blocks[i].isGrouped) {
        const group: VisualBlock[] = [blocks[i]];
        while (i + 1 < blocks.length && blocks[i + 1].isGrouped) {
          i++;
          group.push(blocks[i]);
        }
        termGroups.push(group);
      } else {
        termGroups.push([blocks[i]]);
      }
      i++;
    }

    const elements: React.ReactNode[] = [];
    for (let ti = 0; ti < termGroups.length; ti++) {
      const group = termGroups[ti];

      // Show operator between terms (not before first term unless it's negative)
      if (ti > 0) {
        // Check if this term is negative (constant with negative value)
        const firstBlock = group[0];
        const isNeg = !firstBlock.isGrouped && !firstBlock.isVariable && (firstBlock.label.startsWith('−') || firstBlock.label.startsWith('-'));
        elements.push(
          <span key={`op${ti}`} className="text-gray-400 font-bold text-sm mx-0.5">
            {isNeg ? '−' : '+'}
          </span>
        );
        // If we showed −, remove the − from the block label for display
        if (isNeg && group.length === 1) {
          const absLabel = firstBlock.label.replace(/^[−-]/, '');
          elements.push(
            <span key={`t${ti}`}>
              {renderBlock({ ...firstBlock, label: absLabel }, side)}
            </span>
          );
          continue;
        }
      } else {
        // First term: if it's a standalone negative constant, show the minus
        const firstBlock = group[0];
        if (!firstBlock.isGrouped && !firstBlock.isVariable && (firstBlock.label.startsWith('−') || firstBlock.label.startsWith('-')) && group.length === 1) {
          elements.push(
            <span key={`neg${ti}`} className="text-gray-400 font-bold text-sm mr-0.5">−</span>
          );
          const absLabel = firstBlock.label.replace(/^[−-]/, '');
          elements.push(
            <span key={`t${ti}`}>
              {renderBlock({ ...firstBlock, label: absLabel }, side)}
            </span>
          );
          continue;
        }
      }

      // Render the term (group or single block)
      if (group.length > 1) {
        elements.push(
          <span key={`g${ti}`} className="inline-flex items-center gap-0.5 bg-slate-50 rounded-lg px-1 py-0.5 border border-slate-200">
            {group.map(b => renderBlock(b, side))}
          </span>
        );
      } else {
        elements.push(<span key={`t${ti}`}>{renderBlock(group[0], side)}</span>);
      }
    }
    return elements;
  };

  return (
    <div className={`relative ${wobble ? 'es-wobble' : ''}`}
      onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
    >
      <div className="flex items-center gap-2">
        {/* Left pan */}
        <div ref={leftRef}
          className={`flex-1 rounded-xl border-2 p-3 min-h-[60px] flex flex-wrap items-center justify-center gap-2 transition-all
            ${drag && drag.fromSide === 'right' && overTarget ? 'bg-indigo-100 border-indigo-400 scale-[1.02]' : 'bg-indigo-50 border-indigo-200'}`}
        >
          {expandStep ? (
            <span className="es-pop font-mono font-bold text-purple-700 text-sm px-3 py-2 bg-purple-50 border-2 border-purple-200 rounded-lg">
              {expandStep}
            </span>
          ) : showDist ? (
            <button onClick={onExpand}
              className="font-mono font-bold text-indigo-700 text-base px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-100/50 active:scale-90 transition-all hover:shadow-md cursor-pointer">
              {distributive!.factor}(n + {distributive!.innerConst})
              <span className="block text-[10px] text-indigo-400 font-normal mt-0.5">Tap to expand</span>
            </button>
          ) : showQuot ? (
            <button onClick={onExpand}
              className="font-mono font-bold text-indigo-700 text-base px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-100/50 active:scale-90 transition-all hover:shadow-md cursor-pointer">
              (n {quotient!.innerConst >= 0 ? '+' : '−'} {Math.abs(quotient!.innerConst)}) ÷ {quotient!.divisor}
              <span className="block text-[10px] text-indigo-400 font-normal mt-0.5">Tap to multiply by {quotient!.divisor}</span>
            </button>
          ) : renderSideBlocks(leftBlocks, 'left')}
          {stepAnim && stepAnim.targetSide === 'left' && (
            <span className="es-pop font-mono font-bold text-indigo-600 text-sm bg-indigo-100 border-2 border-indigo-300 rounded-lg px-2 py-1 shadow-md">
              {stepAnim.label}
            </span>
          )}
        </div>

        {/* Fulcrum */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-xl font-bold text-gray-400">=</span>
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[10px] border-l-transparent border-r-transparent border-b-gray-300 mt-1" />
        </div>

        {/* Right pan */}
        <div ref={rightRef}
          className={`flex-1 rounded-xl border-2 p-3 min-h-[60px] flex flex-wrap items-center justify-center gap-2 transition-all
            ${drag && drag.fromSide === 'left' && overTarget ? 'bg-amber-100 border-amber-400 scale-[1.02]' : 'bg-amber-50 border-amber-200'}`}
        >
          {showGrouped ? (
            <span className="font-mono font-bold text-gray-700 text-base px-2.5 py-1.5 rounded-lg border-2 bg-white border-gray-200">
              {showDist ? distributive!.otherSide : quotient!.otherSide}
            </span>
          ) : renderSideBlocks(rightBlocks, 'right')}
          {stepAnim && stepAnim.targetSide === 'right' && (
            <span className="es-pop font-mono font-bold text-amber-700 text-sm bg-amber-100 border-2 border-amber-300 rounded-lg px-2 py-1 shadow-md">
              {stepAnim.label}
            </span>
          )}
        </div>
      </div>

      {/* Equation string */}
      <p className="text-center text-xs font-mono text-gray-400 mt-2">
        {showDist
          ? `${distributive!.factor}(n + ${distributive!.innerConst}) = ${distributive!.otherSide}`
          : showQuot
            ? `(n ${quotient!.innerConst >= 0 ? '+' : '−'} ${Math.abs(quotient!.innerConst)}) ÷ ${quotient!.divisor} = ${quotient!.otherSide}`
            : eqToString(equation)}
      </p>

      {interactive && !showGrouped && (
        <p className="text-center text-xs text-indigo-400 mt-1">Drag a block to the other side</p>
      )}

      {/* Drag ghost */}
      {drag && (
        <div className="fixed pointer-events-none z-50"
          style={{ left: drag.x - 20, top: drag.y - 20, transform: overTarget ? 'scale(1.15)' : 'scale(1)', opacity: overTarget ? 1 : 0.8, transition: 'transform 0.1s' }}>
          <span className="inline-flex items-center justify-center rounded-lg border-2 border-indigo-400 bg-indigo-50 text-indigo-700 font-bold font-mono text-sm px-2.5 py-1.5 shadow-lg">
            {drag.block.label}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function EquationSolver({ onComplete }: EquationSolverProps) {
  const [phase, setPhase] = useState<GamePhase>('pick-equation');
  const [problemIndex, setProblemIndex] = useState(0);
  const [shuffled, setShuffled] = useState<WordProblem[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [equation, setEquation] = useState<EquationState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<EquationState[]>([]);
  const [results, setResults] = useState<ProblemResult[]>([]);
  const [phase1Attempts, setPhase1Attempts] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'solved' | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [wobble, setWobble] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintHighlight, setHintHighlight] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stepAnim, setStepAnim] = useState<StepAnimation | null>(null);
  const [expandStep, setExpandStep] = useState<string | null>(null); // intermediate expansion text

  useEffect(() => { ensureStyles(); }, []);

  // Shuffle problems on mount / play again
  useEffect(() => {
    const s = [...PROBLEMS].sort(() => Math.random() - 0.5);
    setShuffled(s);
    shuffleOptionsFor(s[0]);
  }, []);

  function shuffleOptionsFor(p: WordProblem) {
    const opts = [p.correctEquation, ...p.distractors].sort(() => Math.random() - 0.5);
    setShuffledOptions(opts);
  }

  const handlePlayAgain = useCallback(() => {
    const s = [...PROBLEMS].sort(() => Math.random() - 0.5);
    setShuffled(s);
    shuffleOptionsFor(s[0]);
    setProblemIndex(0);
    setPhase('pick-equation');
    setEquation(null);
    setExpanded(false);
    setHistory([]);
    setResults([]);
    setPhase1Attempts(0);
    setHintUsed(false);
    setStepCount(0);
    setFeedback(null);
    setWrongPick(null);
    setHintText(null);
    setHintHighlight(null);
    setShowConfetti(false);
    setStepAnim(null);
    setExpandStep(null);
  }, []);

  const problem = shuffled[problemIndex];
  if (!problem) return null;

  // ─── Phase 1: Pick equation ────────────────────────────────────

  const handlePick = (eq: string) => {
    if (eq === problem.correctEquation) {
      setPhase1Attempts(prev => prev + 1);
      setFeedback('correct');
      setTimeout(() => {
        setEquation({ ...problem.initial, left: [...problem.initial.left], right: [...problem.initial.right] });
        setExpanded(!problem.distributive && !problem.quotient);
        setPhase('solve-equation');
        setFeedback(null);
        setWrongPick(null);
      }, 800);
    } else {
      setPhase1Attempts(prev => prev + 1);
      setWrongPick(eq);
      setTimeout(() => setWrongPick(null), 600);
    }
  };

  // ─── Phase 2: Solve equation ───────────────────────────────────

  const handleExpand = () => {
    setHintText(null);
    setHintHighlight(null);

    if (problem.distributive) {
      const d = problem.distributive;
      // Phase 1: show the distribution step
      const sign = d.innerConst >= 0 ? '+' : '−';
      setExpandStep(`${d.factor} · n  ${sign}  ${d.factor} · ${Math.abs(d.innerConst)}`);

      // Phase 2: resolve to simplified blocks
      setTimeout(() => {
        setExpandStep(null);
        setEquation(normalize(problem.initial));
        setExpanded(true);
        setWobble(true);
        setStepCount(prev => prev + 1);
        setTimeout(() => setWobble(false), 500);
      }, 1200);
    } else if (problem.quotient) {
      const q = problem.quotient;
      // Phase 1: show the multiplication step
      const sign = q.innerConst >= 0 ? '+' : '−';
      setExpandStep(`(n ${sign} ${Math.abs(q.innerConst)}) × ${q.divisor}  =  ${q.otherSide} × ${q.divisor}`);

      // Phase 2: resolve
      setTimeout(() => {
        setExpandStep(null);
        setEquation(q.expandedLeft);
        setExpanded(true);
        setWobble(true);
        setStepCount(prev => prev + 1);
        setTimeout(() => setWobble(false), 500);
      }, 1200);
    }
  };

  const handleBlockDrop = (action: VisualBlock['action'], fromSide: 'left' | 'right') => {
    if (!equation || wobble || feedback === 'solved' || !action || stepAnim) return;

    setHistory(prev => [...prev, equation]);
    setHintText(null);
    setHintHighlight(null);

    // Determine the animation label and target side
    const targetSide = fromSide === 'left' ? 'right' : 'left';
    let animLabel = '';
    switch (action.type) {
      case 'move': {
        const val = action.value;
        animLabel = val > 0 ? `− ${cleanNum(val)}` : `+ ${cleanNum(Math.abs(val))}`;
        break;
      }
      case 'divide':
        animLabel = `÷ ${cleanNum(action.value)}`;
        break;
      case 'multiply':
        animLabel = `× ${cleanNum(action.value)}`;
        break;
      case 'negate':
        animLabel = '× (−1)';
        break;
    }

    // Phase 1: Show the operation label appearing on the target side
    setStepAnim({ targetSide, label: animLabel });

    // Phase 2: After a brief pause, apply the operation and resolve
    setTimeout(() => {
      let next: EquationState;
      switch (action.type) {
        case 'move': {
          const val = action.value;
          next = val > 0 ? applyOp(equation, '−', val) : applyOp(equation, '+', Math.abs(val));
          break;
        }
        case 'divide':
          next = applyOp(equation, '÷', action.value);
          break;
        case 'multiply':
          next = applyOp(equation, '×', action.value);
          break;
        case 'negate':
          next = applyOp(equation, '×', -1);
          break;
      }

      setStepAnim(null);
      setEquation(next);
      setStepCount(prev => prev + 1);
      setWobble(true);
      setTimeout(() => setWobble(false), 500);

      const check = isSolved(next);
      if (check.solved) {
        setTimeout(() => {
          setFeedback('solved');
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2500);
        }, 600);
      }
    }, 700);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setEquation(prev);
    setHistory(h => h.slice(0, -1));
    setStepCount(s => s - 1);
    setHintText(null);
  };

  const handleHint = () => {
    if (!equation) return;
    const hint = getHintTarget(equation, !!problem.distributive, !!problem.quotient, expanded);
    setHintText(hint.text);
    if ('blockId' in hint) {
      setHintHighlight(hint.blockId);
    } else {
      setHintHighlight(null);
    }
    setHintUsed(true);
  };

  const handleNext = () => {
    // Record result
    const result: ProblemResult = {
      phase1Attempts,
      hintUsed,
      steps: stepCount,
    };
    const newResults = [...results, result];
    setResults(newResults);

    if (problemIndex + 1 >= shuffled.length) {
      // Game complete
      setPhase('game-complete');
      const p1Perfect = newResults.filter(r => r.phase1Attempts === 1).length;
      const p2NoHint = newResults.filter(r => !r.hintUsed).length;
      const stars = (p1Perfect >= 10 && p2NoHint >= 10) ? 3 : (p1Perfect >= 8 && p2NoHint >= 8) ? 2 : 1;
      onComplete?.(stars);
      return;
    }

    // Next problem
    const nextIdx = problemIndex + 1;
    setProblemIndex(nextIdx);
    shuffleOptionsFor(shuffled[nextIdx]);
    setPhase('pick-equation');
    setEquation(null);
    setExpanded(false);
    setHistory([]);
    setPhase1Attempts(0);
    setHintUsed(false);
    setStepCount(0);
    setFeedback(null);
    setWrongPick(null);
    setHintText(null);
    setHintHighlight(null);
    setShowConfetti(false);
    setStepAnim(null);
    setExpandStep(null);
  };

  // ─── Game Complete Screen ──────────────────────────────────────

  if (phase === 'game-complete') {
    const p1Perfect = results.filter(r => r.phase1Attempts === 1).length;
    const p2NoHint = results.filter(r => !r.hintUsed).length;
    const totalHints = results.filter(r => r.hintUsed).length;
    const stars = (p1Perfect >= 10 && p2NoHint >= 10) ? 3 : (p1Perfect >= 8 && p2NoHint >= 8) ? 2 : 1;

    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4 relative">
        <ConfettiParticles />
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center relative z-5">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Problems Solved!</h2>
          <p className="text-gray-500 text-sm mb-6">You solved all 12 equations</p>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map(i => (
              <span key={i} className="es-star-pop text-4xl" style={{
                animationDelay: `${i * 0.2}s`, filter: i <= stars ? 'none' : 'grayscale(1) opacity(0.3)',
              }}>⭐</span>
            ))}
          </div>

          <div className="space-y-2 mb-6 text-sm">
            <div className="flex justify-between bg-indigo-50 rounded-lg px-3 py-2">
              <span className="text-gray-600">Equations picked first try</span>
              <span className="font-bold text-indigo-600">{p1Perfect}/12</span>
            </div>
            <div className="flex justify-between bg-emerald-50 rounded-lg px-3 py-2">
              <span className="text-gray-600">Solved without hints</span>
              <span className="font-bold text-emerald-600">{p2NoHint}/12</span>
            </div>
            <div className="flex justify-between bg-amber-50 rounded-lg px-3 py-2">
              <span className="text-gray-600">Hints used</span>
              <span className="font-bold text-amber-600">{totalHints}</span>
            </div>
          </div>

          <button onClick={handlePlayAgain}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Game Screen ──────────────────────────────────────────

  const solvedResult = equation ? isSolved(equation) : null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-4">

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
          {shuffled.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${
              i < problemIndex ? 'bg-emerald-500' :
                i === problemIndex ? 'bg-indigo-600 ring-2 ring-indigo-200' :
                  'bg-gray-300'
            }`} />
          ))}
        </div>

        {/* Problem counter + category */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase">
            Problem {problemIndex + 1} of {shuffled.length}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            problem.category === 'one-step' ? 'bg-emerald-50 text-emerald-600' :
              problem.category === 'two-step' ? 'bg-blue-50 text-blue-600' :
                'bg-purple-50 text-purple-600'
          }`}>
            {problem.category === 'one-step' ? 'One-step' :
              problem.category === 'two-step' ? 'Two-step' : 'Distributive'}
          </span>
        </div>

        {/* Word problem card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <p className="text-base text-gray-800 leading-relaxed">{problem.text}</p>
        </div>

        {/* Phase 1: Equation options */}
        {phase === 'pick-equation' && (
          <div className="es-pop">
            <p className="text-sm font-semibold text-gray-600 mb-2">Which equation matches this problem?</p>
            <div className="grid grid-cols-2 gap-2">
              {shuffledOptions.map(opt => {
                const isCorrectPick = feedback === 'correct' && opt === problem.correctEquation;
                const isWrong = wrongPick === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handlePick(opt)}
                    disabled={feedback === 'correct'}
                    className={`p-3 rounded-xl border-2 font-mono text-sm font-semibold transition-all active:scale-95
                      ${isCorrectPick ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                        isWrong ? 'border-red-300 bg-red-50 text-red-600 es-shake' :
                          'border-gray-200 bg-white text-gray-700 hover:border-indigo-200'}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 2: Balance scale (drag blocks to solve) */}
        {phase === 'solve-equation' && equation && (
          <div className="es-pop">
            {/* Hint banner */}
            {hintText && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-center">
                <p className="text-amber-700 text-sm font-medium">💡 {hintText}</p>
              </div>
            )}

            {/* Balance scale with draggable blocks */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 relative overflow-hidden">
              {showConfetti && <ConfettiParticles />}
              <DragBalanceScale
                equation={equation}
                wobble={wobble}
                distributive={problem.distributive}
                quotient={problem.quotient}
                expanded={expanded}
                onDrop={handleBlockDrop}
                onExpand={handleExpand}
                hintBlockId={hintHighlight}
                interactive={feedback !== 'solved' && !stepAnim && !expandStep}
                stepAnim={stepAnim}
                expandStep={expandStep}
              />
            </div>

            {/* Solved celebration */}
            {feedback === 'solved' && solvedResult?.solved && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 mb-3 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-emerald-700 text-lg font-bold">
                  n = {cleanNum(solvedResult.value!)}
                </p>
                <p className="text-gray-500 text-xs mt-1 mb-4">
                  Solved in {stepCount} step{stepCount !== 1 ? 's' : ''}
                  {hintUsed ? ' (with hint)' : ''}
                </p>
                <button onClick={handleNext}
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
                  {problemIndex + 1 >= shuffled.length ? 'See Results →' : 'Next Problem →'}
                </button>
              </div>
            )}

            {/* Hint + Undo (only when not solved) */}
            {feedback !== 'solved' && (
              <div className="flex gap-2">
                <button onClick={handleHint}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-50 text-amber-600 border border-amber-200 active:scale-95 transition-transform">
                  💡 Hint
                </button>
                <button onClick={handleUndo}
                  disabled={history.length === 0}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                    ${history.length > 0 ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                  ↩ Undo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
