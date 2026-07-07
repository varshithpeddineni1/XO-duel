import type { Difficulty as DifficultyLevel } from '../api/games.js';
import { DifficultyCard } from '../components/DifficultyCard.js';
import { RematchButton } from '../components/RematchButton.js';

const DIFFICULTIES: Array<{
  key: DifficultyLevel;
  title: string;
  subtitle: string;
  level: number;
}> = [
  { key: 'easy', title: 'Easy', subtitle: 'Relaxed, makes random moves', level: 1 },
  { key: 'medium', title: 'Medium', subtitle: 'Blocks and takes obvious wins', level: 2 },
  { key: 'hard', title: 'Hard', subtitle: 'Strong play, rare mistakes', level: 3 },
  {
    key: 'impossible',
    title: 'Impossible',
    subtitle: 'Perfect play — best you can do is draw',
    level: 4,
  },
];

interface DifficultyProps {
  selected: DifficultyLevel;
  onSelect: (difficulty: DifficultyLevel) => void;
  onStart: () => void;
  onBack: () => void;
}

export function Difficulty({ selected, onSelect, onStart, onBack }: DifficultyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <BackButton onClick={onBack} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          Choose Difficulty
        </div>
      </header>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '12px' }}
      >
        {DIFFICULTIES.map((d) => (
          <DifficultyCard
            key={d.key}
            title={d.title}
            subtitle={d.subtitle}
            level={d.level}
            maxLevel={4}
            selected={selected === d.key}
            onClick={() => onSelect(d.key)}
          />
        ))}
        <div style={{ flex: 1 }} />
        <RematchButton onClick={onStart} label="Start Game" />
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '9px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 700,
      }}
    >
      ‹
    </button>
  );
}
