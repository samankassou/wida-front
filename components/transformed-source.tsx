"use client";
import { useLayoutEffect, useRef, useState } from "react";

export default function TransformedSource({ zoom, rotation, children }: { zoom: number; rotation: number; children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!container.current || !source.current) return;
    const measure = () => {
      const width = container.current?.clientWidth ?? 0;
      const height = source.current?.offsetHeight ?? 0;
      setDimensions((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    observer.observe(source.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const { width, height } = dimensions;
  const scale = zoom / 100;
  const quarterTurn = rotation === 90 || rotation === 270;
  const translateX = rotation === 90 ? height : rotation === 180 ? width : 0;
  const translateY = rotation === 180 ? height : rotation === 270 ? width : 0;
  const measured = width > 0 && height > 0;
  return <div className="rv-transform-container" ref={container}><div className="rv-transform-stage" style={measured ? { width: (quarterTurn ? height : width) * scale, height: (quarterTurn ? width : height) * scale } : undefined}><div className="rv-transform-source" ref={source} style={measured ? { width, position: "absolute", transform: `translate(${translateX * scale}px, ${translateY * scale}px) rotate(${rotation}deg) scale(${scale})` } : undefined}>{children}</div></div></div>;
}

