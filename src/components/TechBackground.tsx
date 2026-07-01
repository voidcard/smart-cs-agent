interface TechBackgroundProps {
  variant?: 'full' | 'subtle';
}

/** 高级感背景：柔和光晕网格，无杂乱浮动元素 */
export function TechBackground({ variant = 'full' }: TechBackgroundProps) {
  const isFull = variant === 'full';

  return (
    <div className={`premium-bg premium-bg--${variant}`} aria-hidden="true">
      <div className="premium-bg__mesh" />
      {isFull && (
        <>
          <div className="premium-bg__orb premium-bg__orb--1" />
          <div className="premium-bg__orb premium-bg__orb--2" />
          <div className="premium-bg__orb premium-bg__orb--3" />
          <div className="premium-bg__grid" />
        </>
      )}
      {!isFull && <div className="premium-bg__orb premium-bg__orb--subtle" />}
    </div>
  );
}
