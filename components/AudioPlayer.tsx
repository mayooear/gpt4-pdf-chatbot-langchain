import React, { useEffect } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAudioContext } from '@/contexts/AudioContext';

interface AudioPlayerProps {
  src: string;
  startTime: number;
  endTime?: number;
  audioId: string;
}

export function AudioPlayer({ src, startTime, endTime, audioId }: AudioPlayerProps) {
  const { currentlyPlayingId, setCurrentlyPlayingId } = useAudioContext();
  const isGloballyPlaying = currentlyPlayingId === audioId;
  
  const { audioRef, isPlaying, currentTime, duration, togglePlayPause, setAudioTime } = useAudioPlayer({
    src,
    startTime,
    endTime,
    audioId,
    isGloballyPlaying,
  });

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTogglePlayPause = () => {
    if (!isPlaying) {
      setCurrentlyPlayingId(audioId);
    } else {
      setCurrentlyPlayingId(null);
    }
    togglePlayPause();
  };

  return (
    <div className="audio-player bg-gray-100 p-4 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center justify-between">
        <button
          onClick={handleTogglePlayPause}
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