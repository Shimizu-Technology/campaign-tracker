type PublicWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
  className?: string;
};

const SIZE_STYLES = {
  sm: {
    title: 'text-xl md:text-2xl',
    amp: 'text-lg md:text-xl',
    subtitle: 'text-[8px] md:text-[9px]',
    gap: 'gap-1',
  },
  md: {
    title: 'text-4xl md:text-5xl',
    amp: 'text-3xl md:text-4xl',
    subtitle: 'text-[10px] md:text-xs',
    gap: 'gap-1.5',
  },
  lg: {
    title: 'text-5xl md:text-6xl',
    amp: 'text-4xl md:text-5xl',
    subtitle: 'text-xs md:text-sm',
    gap: 'gap-2',
  },
} as const;

export default function PublicWordmark({
  size = 'md',
  centered = false,
  className = '',
}: PublicWordmarkProps) {
  const styles = SIZE_STYLES[size];

  return (
    <div
      className={[
        'inline-flex flex-col leading-none',
        centered ? 'items-center text-center' : 'items-start text-left',
        className,
      ].join(' ')}
    >
      <div className={`flex items-end ${styles.gap}`}>
        <span className={`${styles.title} -skew-x-12 font-black uppercase tracking-[-0.08em] text-primary`}>
          Josh
        </span>
        <span className={`${styles.amp} font-black uppercase text-cta`}>
          &amp;
        </span>
        <span className={`${styles.title} -skew-x-12 font-black uppercase tracking-[-0.08em] text-primary`}>
          Tina
        </span>
      </div>
      <p className={`${styles.subtitle} mt-1 font-semibold uppercase tracking-[0.22em] text-slate-500`}>
        For Governor &amp; Lt. Governor
      </p>
    </div>
  );
}
