"use client";

import { useSim, getEngine } from "@/store/simulatorStore";
import { Thermometer, Sun, Joystick } from "@phosphor-icons/react";

interface ChannelSliderProps {
  ch: number;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  unit: string;
  displayVal: (raw: number) => string;
}

function ChannelSlider({ ch, label, icon, min, max, unit, displayVal }: ChannelSliderProps) {
  const value = useSim((s) => s.adcInputs[ch]);
  const setAdc = useSim((s) => s.setADCInput);

  const displayed = displayVal(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">{icon}</span>
          <span className="text-[11px] text-fg/80">{label}</span>
        </div>
        <span className="font-mono text-[11px] text-mono">
          {displayed} {unit}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1023}
        value={value}
        onChange={(e) => setAdc(ch, parseInt(e.target.value, 10))}
        className="adc-slider w-full"
        aria-label={`${label} ADC input`}
      />
      <div className="flex justify-between">
        <span className="font-mono text-[9px] text-muted">{min} {unit}</span>
        <span className="font-mono text-[9px] text-muted">CH{ch} · raw {value}</span>
        <span className="font-mono text-[9px] text-muted">{max} {unit}</span>
      </div>
    </div>
  );
}

export function ADCInputs() {
  return (
    <div className="flex flex-col gap-4 px-1">
      <ChannelSlider
        ch={2} label="LDR (Light)" unit="lux"
        icon={<Sun size={13} weight="duotone" />}
        min={0} max={65535}
        displayVal={(v) => Math.round((v / 1023) * 65535).toString()}
      />
      <ChannelSlider
        ch={3} label="LM35 (Temp)" unit="°C"
        icon={<Thermometer size={13} weight="duotone" />}
        min={0} max={100}
        displayVal={(v) => ((v / 1023) * 100).toFixed(1)}
      />
      <ChannelSlider
        ch={4} label="Potentiometer" unit="%"
        icon={<Joystick size={13} weight="duotone" />}
        min={0} max={100}
        displayVal={(v) => ((v / 1023) * 100).toFixed(0)}
      />
    </div>
  );
}
