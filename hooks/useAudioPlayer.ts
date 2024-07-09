import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerProps {
  src: string | null;
  startTime: number;
  endTime?: number;
  audioId: string;
  isGloballyPlaying: boolean;
}

export function useAudioPlayer({ src, startTime, endTime, audioId, isGloballyPlaying }: UseAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
      audio.currentTime = startTime;
    };

    const handleCanPlayThrough = () => {
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = startTime;
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [startTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    setIsLoaded(false); // Reset isLoaded when src changes
    audio.src = src;
    audio.load(); // This triggers the loading of the audio file
  }, [src]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setError(null);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        setError('Failed to play audio. Please try again.');
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, src]);

  const setAudioTime = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      setIsSeeking(true);
      audio.currentTime = time;
      setCurrentTime(time);
      if (isPlaying) {
        audio.play().catch(error => {
          console.error('Error playing audio after seeking:', error);
          setError('Failed to play audio after seeking. Please try again.');
          setIsPlaying(false);
        });
      }
      setIsSeeking(false);
    }
  }, [isPlaying]);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    setAudioTime,
    isLoaded,
    error,
    isSeeking,
  };
}