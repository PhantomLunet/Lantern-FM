"use client";

import { useRef, useCallback, useEffect, useState } from 'react';

interface NoiseGeneratorOptions {
  masterVolume: number;
  muted: boolean;
  isPlaying: boolean;
  levels: Record<string, number>;
}

const MULTIPLIERS: Record<string, number> = {
  rain: 0.65,
  thunder: 0.8,
  wind: 0.55,
  fire: 0.5,
  vinyl: 0.3,
  cafe: 0.4,
  train: 0.5,
  keys: 0.25,
};

// Creates various ambient noise types using Web Audio API
export function useNoiseGenerator({
  masterVolume,
  muted,
  isPlaying,
  levels,
}: NoiseGeneratorOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Record<string, { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode; filter?: BiquadFilterNode }>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize audio context on user interaction
  const initAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      setInitialized(true);
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // Create white noise buffer
  const createNoiseBuffer = useCallback((ctx: AudioContext, type: 'white' | 'pink' | 'brown' = 'white') => {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else { // brown
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
    }
    
    return buffer;
  }, []);

  // Create ambient sound node
  const createAmbientSound = useCallback((id: string, volume: number) => {
    const ctx = audioContextRef.current;
    if (!ctx || volume === 0) return;

    // Stop existing node
    if (nodesRef.current[id]) {
      try {
        nodesRef.current[id].source.stop();
        nodesRef.current[id].gain.disconnect();
        nodesRef.current[id].filter?.disconnect();
      } catch {}
      delete nodesRef.current[id];
    }

    const gainNode = ctx.createGain();
    const effectiveVolume = (volume / 100) * (muted ? 0 : masterVolume / 100);
    
    let source: AudioBufferSourceNode | OscillatorNode;
    let filter: BiquadFilterNode | undefined;

    switch (id) {
      case 'rain': {
        // Rain: filtered white noise
        const noiseBuffer = createNoiseBuffer(ctx, 'pink');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2500;
        filter.Q.value = 0.5;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'thunder': {
        // Thunder: low rumble with brown noise
        const noiseBuffer = createNoiseBuffer(ctx, 'brown');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        filter.Q.value = 1;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'wind': {
        // Wind: modulated low-frequency noise
        const noiseBuffer = createNoiseBuffer(ctx, 'pink');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.8;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'fire': {
        // Fire: crackling filtered noise
        const noiseBuffer = createNoiseBuffer(ctx, 'brown');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 2;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'vinyl': {
        // Vinyl: high-frequency crackle
        const noiseBuffer = createNoiseBuffer(ctx, 'white');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 4000;
        filter.Q.value = 0.3;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'cafe': {
        // Cafe: layered noise simulating chatter
        const noiseBuffer = createNoiseBuffer(ctx, 'pink');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.4;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'train': {
        // Train: rhythmic low rumble
        const noiseBuffer = createNoiseBuffer(ctx, 'brown');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 1.5;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      case 'keys': {
        // Keyboard: soft tapping noise
        const noiseBuffer = createNoiseBuffer(ctx, 'white');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 3;
        
        source.connect(filter);
        filter.connect(gainNode);
        break;
      }
      
      default: {
        // Default: gentle noise
        const noiseBuffer = createNoiseBuffer(ctx, 'pink');
        source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.connect(gainNode);
      }
    }

    gainNode.gain.value = effectiveVolume * (MULTIPLIERS[id] || 0.1);
    gainNode.connect(ctx.destination);
    source.start();

    nodesRef.current[id] = { source, gain: gainNode, filter };
  }, [createNoiseBuffer, masterVolume, muted]);

  // Stop specific sound
  const stopSound = useCallback((id: string) => {
    if (nodesRef.current[id]) {
      try {
        nodesRef.current[id].source.stop();
        nodesRef.current[id].gain.disconnect();
        nodesRef.current[id].filter?.disconnect();
      } catch {}
      delete nodesRef.current[id];
    }
  }, []);

  // Stop all sounds
  const stopAllSounds = useCallback(() => {
    Object.keys(nodesRef.current).forEach(stopSound);
  }, [stopSound]);

  // Update sounds based on levels and playing state
  useEffect(() => {
    if (!isPlaying) {
      stopAllSounds();
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;

    Object.entries(levels).forEach(([id, level]) => {
      if (level > 0) {
        if (!nodesRef.current[id]) {
          createAmbientSound(id, level);
        } else {
          // Update volume
          const effectiveVolume = (level / 100) * (muted ? 0 : masterVolume / 100);
          nodesRef.current[id].gain.gain.value = effectiveVolume * (MULTIPLIERS[id] || 0.1);
        }
      } else {
        stopSound(id);
      }
    });
  }, [levels, isPlaying, createAmbientSound, stopSound, stopAllSounds, masterVolume, muted]);

  // Update all volumes when master volume or mute changes
  useEffect(() => {
    Object.entries(nodesRef.current).forEach(([id, { gain }]) => {
      const level = levels[id] || 0;
      const effectiveVolume = (level / 100) * (muted ? 0 : masterVolume / 100);
      gain.gain.value = effectiveVolume * (MULTIPLIERS[id] || 0.1);
    });
  }, [masterVolume, muted, levels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSounds();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stopAllSounds]);

  return {
    initialized,
    initAudioContext,
    stopAllSounds,
  };
}
