import { MORSE_CODE_MAP } from "./constants";

interface ReferenceListProps {
  title: string;
  filter: (char: string) => boolean;
  twoCols?: boolean;
}

export const ReferenceList = ({
  title,
  filter,
  twoCols = false,
}: ReferenceListProps) => {
  return (
    <div className="bg-[#1a2e22]/90 border border-[#2c3e30] rounded-lg p-3 shadow-lg backdrop-blur-sm w-full">
      <div className="text-[10px] text-[#4caf50] font-bold tracking-widest border-b border-[#2c5c3e] pb-1 mb-2 text-center">
        {title}
      </div>
      <div
        className={`grid ${twoCols ? "grid-cols-2" : "grid-cols-1"} gap-x-4 gap-y-1 text-xs font-mono`}
      >
        {Object.entries(MORSE_CODE_MAP)
          .filter(([_, char]) => filter(char))
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([code, char]) => (
            <div
              key={char}
              className="flex justify-between items-center text-[#a5d6a7]/80 hover:text-white transition-colors"
            >
              <span className="font-bold w-4 md:w-6">{char}</span>
              <span className="tracking-widest text-[#4caf50]">{code}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
