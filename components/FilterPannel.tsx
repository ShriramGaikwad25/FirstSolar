interface FilterPanelProps {
  data: Record<string, DataItem[]>;
  selected: { [key: string]: number | null };
  onSelect: (category: string, index: number) => void;
  onClear: (category: string) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  data,
  selected,
  onSelect,
  onClear,
}) => {
  return (
    <>
      {Object.entries(data).map(([category, items]) => (
        <div key={category}>
          <div className="flex justify-between items-center mb-1 border-gray-300 pb-2 p-1">
            <h3 className="text-sm text-gray-700">
              {category.replace(/([A-Z])/g, " $1")}
            </h3>
            <button
              onClick={() => onClear(category)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Clear
              {selected[category] !== undefined &&
              selected[category] !== null ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 text-blue-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-5.6 7.5V18a1 1 0 01-.45.84l-4 2.5A1 1 0 019 20.5v-8.4L3.2 5.6A1 1 0 013 4z"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="space-y-1 pl-1 pr-1">
            {items.map((item, index) => (
              <div
                key={index}
                className={`flex text-xs relative items-center p-1.5 rounded-sm cursor-pointer transition-all ${
                  selected[category] === index
                    ? "bg-[#6574BD] text-white"
                    : "bg-[#F0F2FC] hover:bg-[#e5e9f9]"
                } ${item.color || ""}`}
                onClick={() => onSelect(category, index)}
              >
                <span>{item.label}</span>
                <span
                  className={`font-semibold absolute -right-1 bg-white border p-0.5 text-[10px] rounded-sm ${
                    selected[category] === index
                      ? "border-[#6574BD] text-[#6574BD]"
                      : "border-[#e5e9f9]"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default FilterPanel;
