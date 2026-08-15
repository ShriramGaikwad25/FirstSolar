import React from "react";

const VennDiagram = () => {
  const handleClick = (label: string) => {
    alert(`Clicked: ${label}`);
  };

  return (
    <div className="flex justify-center gap-10">
      {/* Diagram */}
      <div className="relative w-[400px] h-[300px]">

        {/* USERS */}
        <div
          className="absolute w-40 h-40 bg-blue-500/50 rounded-full left-[40px] top-[100px] z-10 cursor-pointer"
          onClick={() => handleClick("Users")}
        />

        {/* ACCOUNTS */}
        <div
          className="absolute w-40 h-40 bg-green-500/50 rounded-full left-[120px] top-[100px] z-10 cursor-pointer"
          onClick={() => handleClick("Accounts")}
        />

        {/* ENTITLEMENTS */}
        <div
          className="absolute w-40 h-40 bg-yellow-500/50 rounded-full left-[80px] top-[40px] z-10 cursor-pointer"
          onClick={() => handleClick("Entitlements")}
        />

        {/* Clickable Intersection Zones (invisible) */}
        <div
          className="absolute w-16 h-16 left-[105px] top-[125px] z-20 cursor-pointer"
          onClick={() => handleClick("Users ∩ Accounts")}
        />
        <div
          className="absolute w-16 h-16 left-[85px] top-[100px] z-20 cursor-pointer"
          onClick={() => handleClick("Users ∩ Entitlements")}
        />
        <div
          className="absolute w-16 h-16 left-[125px] top-[100px] z-20 cursor-pointer"
          onClick={() => handleClick("Accounts ∩ Entitlements")}
        />
        <div
          className="absolute w-12 h-12 left-[110px] top-[110px] z-30 cursor-pointer"
          onClick={() => handleClick("Users ∩ Accounts ∩ Entitlements")}
        />

        {/* Labels (now clearly visible) */}
        <div className="absolute left-[60px] top-[180px] z-40 text-black font-semibold bg-white bg-opacity-60 px-2 py-1 rounded">
          30
        </div>
        <div className="absolute left-[220px] top-[180px] z-40 text-black font-semibold bg-white bg-opacity-80 px-2 py-1 rounded">
          60
        </div>
        <div className="absolute left-[140px] top-[50px] z-40 text-black font-semibold bg-white bg-opacity-80 px-2 py-1 rounded">
          200
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-3 mt-30">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-gray-700 font-medium">Users</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span className="text-gray-700 font-medium">Accounts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500" />
          <span className="text-gray-700 font-medium">Entitlements</span>
        </div>
      </div>
    </div>
  );
};

export default VennDiagram;
