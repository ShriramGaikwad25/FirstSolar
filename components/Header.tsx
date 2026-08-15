import HeaderContent from './HeaderContent';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full" style={{ backgroundColor: '#27B973' }}>
      <div className="flex h-[60px] px-6 items-center">
        {/* Main Header Content */}
        <HeaderContent />
      </div>
    </header>
  );
}
