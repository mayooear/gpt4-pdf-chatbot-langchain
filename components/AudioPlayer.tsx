import React, { useEffect, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const { audioRef, isPlaying, currentTime, duration, togglePlayPause, setAudioTime, isLoaded } = useAudioPlayer({
    src: audioUrl,
    startTime,
    endTime,
    audioId,
    isGloballyPlaying: currentlyPlayingId === audioId,
  });

  useEffect(() => {
    const fetchAudioUrl = async () => {
      try {
        const filename = src.split('/').pop();
        if (!filename) {
          throw new Error('Invalid audio source');
        }
        
        const response = await fetch(`/api/audio/${encodeURIComponent(filename)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch audio URL');
        }
        const data = await response.json();
        setAudioUrl(data.url);
        setError(null);
      } catch (error) {
        console.error('Error fetching audio URL:', error);
        setError('Failed to load audio. Please try again.');
        setAudioUrl(null);
      }
    };

    fetchAudioUrl();
  }, [src]);

  useEffect(() => {
    if (currentlyPlayingId && currentlyPlayingId !== audioId && isPlaying) {
      togglePlayPause();
    }
  }, [currentlyPlayingId, audioId, isPlaying, togglePlayPause]);

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
      <audio ref={audioRef} preload="metadata" />
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div className="flex items-center justify-between">
        <button
          onClick={handleTogglePlayPause}
          className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none ${!isLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isLoaded || !!error}
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
          disabled={!isLoaded || !!error}
        />
      </div>
    </div>
  );
}