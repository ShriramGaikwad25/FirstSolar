'user client';
import { useEffect, useState } from "react";
import { CircleMinus, CirclePlus } from "lucide-react";


interface AccordionProps {
  headerText?: string;
  title?:string;
  children: React.ReactNode;
  iconSize?:number;
  iconClass?:string;
  open?:boolean;
  onToggle?: () => void;
}

const Accordion = ({ headerText, children, iconSize, title, iconClass, open, onToggle  }: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(open ?? true);

    useEffect(() => {
    if (typeof open === 'boolean') {
      setIsOpen(open);
    }
  }, [open]);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setIsOpen((prev) => !prev);
    }  };
  return (
    <div className="transition-all duration-150 ease-in-out transform" style={{ minHeight: 'auto' }}> 
      <button
        className={`flex cursor-pointer items-center ${iconClass}`}
        onClick={handleToggle}
        title={title}
        style={{ minHeight: 'auto' }}
      > 
        {isOpen ? <CircleMinus size={iconSize || 16} /> : <CirclePlus size={iconSize || 16} />}
        {headerText && <small>{headerText}</small>}
      </button>

      {isOpen && <div style={{ minHeight: 'auto' }}>{children}</div>}
    </div>
  );
};

export default Accordion;
