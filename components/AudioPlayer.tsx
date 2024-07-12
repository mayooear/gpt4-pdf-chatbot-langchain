import React, { useEffect, useState, useCallback } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAudioContext } from '@/contexts/AudioContext';

interface AudioPlayerProps {
  src: string;
  startTime: number;
  endTime?: number;
  audioId: string;
  lazyLoad?: boolean;
  isExpanded?: boolean;
}

export function AudioPlayer({ src, startTime, endTime, audioId, lazyLoad = false, isExpanded = false }: AudioPlayerProps) {
  const [isLoaded, setIsLoaded] = useState(!lazyLoad);
  const { currentlyPlayingId, setCurrentlyPlayingId } = useAudioContext();
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  const { 
    audioRef, 
    isPlaying, 
    currentTime, 
    duration, 
    togglePlayPause, 
    setAudioTime, 
    isLoaded: isAudioLoaded,
    error: audioError,
    isSeeking
  } = useAudioPlayer({
    src: audioUrl,
    startTime,
    endTime,
    audioId,
    isGloballyPlaying: currentlyPlayingId === audioId,
  });

  const fetchAudioUrl = useCallback(async () => {
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
      setIsLoaded(true);
    } catch (error) {
      console.error('Error fetching audio URL:', error);
      setError('Failed to load audio. Please try again.');
      setAudioUrl(null);
    }
  }, [src]);

  useEffect(() => {
    if ((!lazyLoad || isExpanded) && !isLoaded) {
      fetchAudioUrl();
    }
  }, [lazyLoad, isExpanded, isLoaded, fetchAudioUrl]);

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
    if (!isLoaded) {
      setIsLoaded(true);
    } else {
      if (!isPlaying) {
        setCurrentlyPlayingId(audioId);
      } else {
        setCurrentlyPlayingId(null);
      }
      togglePlayPause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setAudioTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [audioRef, volume]);

  return (
    <div className="audio-player bg-gray-100 rounded-lg w-full md:w-1/2">
      <audio ref={audioRef} preload="metadata" />
      {error && <div className="text-red-500 mb-1 text-sm px-2">{error}</div>}
      {audioError && <div className="text-red-500 mb-1 text-sm px-2">{audioError}</div>}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={handleTogglePlayPause}
          className={`text-blue-500 p-1 rounded-full hover:bg-blue-100 focus:outline-none ${!isLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isLoaded || !!error || !!audioError || isSeeking}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          <span className="material-icons text-2xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
        </button>
        <div className="text-xs">
          {formatTime(currentTime)} / {formatTime(endTime || duration)}
        </div>
        <div className="flex items-center ml-2">
          <span className="material-icons text-sm mr-1">volume_up</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={handleVolumeChange}
            className="w-16"
            aria-label="Volume control"
          />
        </div>
      </div>
      <div className="px-2 pb-2">
        <input
          type="range"
          min={0}
          max={endTime || duration}
          value={currentTime}
          onChange={handleSeek}
          className="w-full"
          disabled={!isLoaded || !!error || !!audioError}
        />
      </div>
    </div>
  );
}