import { useState } from "react";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";

interface SortableItemProps {
  field: string;
  col: { headerName: string };
  toggleColumn: (field: string) => void;
  isVisible: boolean;
}

const SortableItem = ({
  field,
  col,
  toggleColumn,
  isVisible,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field });
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="flex items-center cursor-pointer hover:bg-gray-100  gap-2 w-full p-2"
      style={{
        transform: transform ? `translateY(${transform.y}px)` : undefined,
        transition,
      }}
      onMouseUp={() => setTimeout(() => setIsDragging(false), 100)}
      onMouseDown={(e) => {
        setIsDragging(true);
        if (!isDragging) {
          e.stopPropagation();
          toggleColumn(field);
        }
      }}
    >
      <GripVertical
        className="w-4 h-4 text-gray-500 cursor-grab"
        {...listeners}
      />
      {isVisible ? (
        <Eye className="w-4 h-4 text-green-500" />
      ) : (
        <EyeOff className="w-4 h-4 text-gray-400" />
      )}
      <span>{col.headerName}</span>
    </div>
  );
};

export default SortableItem;
