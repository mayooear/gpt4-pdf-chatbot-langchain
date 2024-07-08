import React from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface AudioPlayerProps {
  src: string;
  startTime: number;
  endTime?: number;
  onPlay: () => void;
  onPause: () => void;
}

export function AudioPlayer({ src, startTime, endTime, onPlay, onPause }: AudioPlayerProps) {
  const { audioRef, isPlaying, currentTime, duration, togglePlayPause, setAudioTime } = useAudioPlayer({
    src,
    startTime,
    endTime,
  });

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (isPlaying) {
      onPlay();
    } else {
      onPause();
    }
  }, [isPlaying, onPlay, onPause]);

  return (
    <div className="audio-player bg-gray-100 p-4 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center justify-between">
        <button
          onClick={togglePlayPause}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="text-sm">
          {formatTime(currentTime)} / {formatTime(endTime || duration)}
        </div>
      </div>
      <div className="mt-2">
        <input
          type="range"
          min={0}
          max={endTime || duration}
          value={currentTime}
          onChange={(e) => setAudioTime(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}