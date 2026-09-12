import { MobileDrawer } from './MobileDrawer';
import { LogoLockup } from './Logo';
import { Search } from 'lucide-react';

interface Props {
  onOpenPalette?: () => void;
}

export function Topbar({ onOpenPalette }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border lg:hidden">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <MobileDrawer />
          <LogoLockup size={22} className="ml-1" />
        </div>
        <button
          onClick={onOpenPalette}
          aria-label="Buscar"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
