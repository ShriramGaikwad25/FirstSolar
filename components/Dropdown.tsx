import { ElementType, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DropdownProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode[];
  Icon: ElementType;
  name?: string;
  menuWidth?: number;
  className?: string;
  onCloseMenu?: (closeFunc: () => void) => void;
}

const Dropdown = ({ Icon, children, name, className, menuWidth = 160, onCloseMenu, ...props }: DropdownProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  
  const getAllScrollableParents = (element: HTMLElement | null): HTMLElement[] => {
    const scrollableParents: HTMLElement[] = [];
    while (element && element !== document.body) {
      const overflowY = window.getComputedStyle(element).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollableParents.push(element);
      }
      element = element.parentElement;
    }
    return scrollableParents;
  };


  const updateMenuPosition = useCallback(() => {
    if (menuButtonRef.current) {
      const buttonRect = menuButtonRef.current.getBoundingClientRect();
      const top = buttonRect.bottom;
      const left = buttonRect.right - menuWidth;
      setMenuPosition({ top, left });
    }
  },[menuWidth]);


  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    // Expose the close function to parent components
    if (onCloseMenu) {
      onCloseMenu(() => setIsMenuOpen(false));
    }
  }, [onCloseMenu]);

  useEffect(() => {
    if (isMenuOpen) {
      updateMenuPosition();

      const handleClickOutside = (event: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(event.target as Node) &&
          menuButtonRef.current &&
          !menuButtonRef.current.contains(event.target as Node)
        ) {
          setIsMenuOpen(false);
        }
      };

      const handleScrollOrResize = () => {
        requestAnimationFrame(updateMenuPosition);
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, { passive: true });

      const scrollableParents = getAllScrollableParents(menuButtonRef.current);
      scrollableParents.forEach((parent) => {
        parent.addEventListener("scroll", handleScrollOrResize, { passive: true });
      });

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize);

        scrollableParents.forEach((parent) => {
          parent.removeEventListener("scroll", handleScrollOrResize);
        });
      };
    }
  }, [isMenuOpen, updateMenuPosition]);

  return (
    <>
      <button
        ref={menuButtonRef}
        onClick={toggleMenu}
        title="Menu"
        className={`cursor-pointer rounded-sm hover:opacity-80 ${className} ${
          isMenuOpen ? "bg-[#6D6E73]/20" : ""
        }`}
        {...props}
      >
        <Icon color="#35353A" size="32" className="transform scale-[0.6]" /> {name}
      </button>

      {isMenuOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed bg-white border border-gray-300 shadow-lg rounded-md z-50 p-2"
            style={{
              position: "fixed",
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              minWidth: `${menuWidth}px`,
              padding: "8px",
            }}
          >
            <ul className="text-sm text-gray-700">{children}</ul>
          </div>,
          document.body
        )}
    </>
  );
};

export default Dropdown;
