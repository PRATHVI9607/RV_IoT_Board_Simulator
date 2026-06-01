"use client";

import { useEffect, useRef } from "react";
import { useSim } from "@/store/simulatorStore";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

/**
 * Buzzer — driven by PWM (frequency from PWM period) or raw GPIO HIGH.
 * Uses Web Audio API: OscillatorNode → GainNode → destination.
 */
export function Buzzer() {
  const duty = useSim((s) => s.snap.periph.pwmDuty[0]); // PWM1
  const gpio = useSim((s) => s.snap.gpio);
  const muted = useSim((s) => s.buzzerMuted);
  const toggleMute = useSim((s) => s.toggleBuzzerMute);

  // Buzzer active when any relevant output pin is high (P0.16-P0.19 via ULN2803)
  const gpioOn = (gpio.out[0] & 0x000f0000) !== 0 && (gpio.dir[0] & 0x000f0000) !== 0;
  const active = duty > 0.01 || gpioOn;

  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (active && !muted) {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
        const osc = ctxRef.current.createOscillator();
        const gain = ctxRef.current.createGain();
        osc.type = "square";
        osc.frequency.value = duty > 0.01 ? 2000 : 1500;
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(ctxRef.current.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
      }
    } else {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current = null;
        ctxRef.current?.close();
        ctxRef.current = null;
      }
    }
    return () => {
      if (oscRef.current) { oscRef.current.stop(); oscRef.current = null; }
      ctxRef.current?.close().catch(() => null);
      ctxRef.current = null;
    };
  }, [active, muted, duty]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all ${
          active && !muted
            ? "buzzer-active border-signal-amber bg-[rgba(251,191,36,0.15)] shadow-[0_0_16px_rgba(251,191,36,0.4)]"
            : "border-line-strong bg-pane"
        }`}
        aria-label={active ? "Buzzer active" : "Buzzer inactive"}
      >
        <SpeakerHigh
          size={22}
          weight="fill"
          className={active && !muted ? "text-signal-amber" : "text-muted"}

        />
      </div>
      <Button variant="ghost" onClick={toggleMute} className="text-[10px]">
        {muted ? <SpeakerSlash size={12} /> : <SpeakerHigh size={12} />}
        {muted ? "Unmute" : "Mute"}
      </Button>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        Buzzer · P0.16–19 + ULN2803
      </span>
    </div>
  );
}
