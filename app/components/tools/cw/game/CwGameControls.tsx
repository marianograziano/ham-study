import { Prohibit } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

interface CwGameControlsProps {
  currentPattern: string;
  isPlaying: boolean;
  isPaused: boolean;
  onDit: () => void;
  onDah: () => void;
  onClear: () => void;
}

export function CwGameControls({
  currentPattern,
  isPlaying,
  isPaused,
  onDit,
  onDah,
  onClear,
}: CwGameControlsProps) {
  const isDisabled = !isPlaying || isPaused;

  return (
    <div className="w-full p-6 bg-slate-950 border-t border-slate-800 z-20">
      <div className="max-w-4xl mx-auto">
        {/* Pattern Display */}
        <div className="mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            你的输入
          </div>
          <div className="flex items-center justify-between">
            <div className="text-4xl font-bold text-green-400 min-h-[48px] tracking-wider">
              {currentPattern || (
                <span className="text-slate-700">等待输入...</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={!currentPattern}
              className="text-slate-500 hover:text-red-400"
            >
              <Prohibit className="w-4 h-4 mr-1" />
              清空
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            size="lg"
            onClick={onDit}
            disabled={isDisabled}
            className="bg-slate-800 hover:bg-slate-700 border-2 border-green-600/50 h-20 text-2xl"
          >
            <span className="text-green-400 mr-2 text-3xl">·</span>
            <span className="hidden sm:inline">点</span>
            <span className="text-xs text-slate-500 ml-2">(Space)</span>
          </Button>
          <Button
            size="lg"
            onClick={onDah}
            disabled={isDisabled}
            className="bg-slate-800 hover:bg-slate-700 border-2 border-green-600/50 h-20 text-2xl"
          >
            <span className="text-green-400 mr-2 text-3xl">−</span>
            <span className="hidden sm:inline">划</span>
            <span className="text-xs text-slate-500 ml-2">(Enter)</span>
          </Button>
        </div>

        {/* Keyboard hint */}
        <div className="mt-4 text-center text-xs text-slate-500">
          空格 = ·（点） | 回车 = −（划） | 退格 = 删除 | ESC = 暂停
        </div>
      </div>
    </div>
  );
}
