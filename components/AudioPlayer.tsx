import React, { useRef, useState, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  startTime: number;
  endTime?: number;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, startTime, endTime, onPlay, onPause, isPlaying }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      audio.currentTime = startTime;
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [startTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(error => console.error('Error playing audio:', error));
    } else {
      audio.pause();
    }
  }, [isPlaying, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (endTime && audio.currentTime >= endTime) {
        audio.pause();
        onPause();
      }
    };

    const handleEnded = () => {
      onPause();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [endTime, onPause]);

  const togglePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
          onChange={(e) => {
            const newTime = parseFloat(e.target.value);
            setCurrentTime(newTime);
            if (audioRef.current) {
              audioRef.current.currentTime = newTime;
            }
          }}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default AudioPlayer;