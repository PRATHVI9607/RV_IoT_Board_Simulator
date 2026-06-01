"use client";

import { useEffect, useRef } from "react";
import { useSim } from "@/store/simulatorStore";

/**
 * Three.js 3D board render (Phase 3).
 * Dynamically imported so it doesn't bloat the main bundle.
 * LEDs respond live to GPIO state on every animation frame.
 */
export function Board3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let running = true;

    (async () => {
      const THREE = await import("three");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js" as string) as { OrbitControls: any };

      const w = mountRef.current!.clientWidth || 800;
      const h = mountRef.current!.clientHeight || 500;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      mountRef.current!.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0d10);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
      camera.position.set(0, 0.25, 0.35);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);

      // Lighting
      scene.add(new THREE.AmbientLight(0x334455, 0.8));
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(0.3, 0.6, 0.5);
      sun.castShadow = true;
      scene.add(sun);

      // PCB board
      const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0d1a10, roughness: 0.5, metalness: 0.1 });
      const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.001, 0.14), pcbMat);
      pcb.receiveShadow = true;
      scene.add(pcb);

      // LPC2148 IC
      const icMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.3, metalness: 0.4 });
      const ic = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.003, 0.028), icMat);
      ic.position.set(0, 0.002, 0);
      ic.castShadow = true;
      scene.add(ic);

      // 8 LEDs on P0.0–P0.7
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ledLights: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ledMeshes: any[] = [];
      for (let i = 0; i < 8; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x39ff14, emissive: 0x39ff14, emissiveIntensity: 0 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 8), mat);
        mesh.position.set(-0.09 + i * 0.026, 0.003, 0.06);
        scene.add(mesh);
        ledMeshes.push(mesh);

        const light = new THREE.PointLight(0x39ff14, 0, 0.05);
        light.position.copy(mesh.position).add(new THREE.Vector3(0, 0.01, 0));
        scene.add(light);
        ledLights.push(light);
      }

      // Decorative ICs
      const miniIcPositions: [number, number][] = [[-0.07, 0.04], [0.07, 0.04], [-0.07, -0.04]];
      miniIcPositions.forEach(([x, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.002, 0.012), icMat.clone());
        m.position.set(x, 0.0015, z);
        scene.add(m);
      });

      // LCD module
      const lcdMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.004, 0.024),
        new THREE.MeshStandardMaterial({ color: 0x0a1a0c, roughness: 0.4 }),
      );
      lcdMesh.position.set(-0.04, 0.003, -0.04);
      scene.add(lcdMesh);

      // PCB trace lines
      const traceVerts: number[] = [];
      for (let i = 0; i < 8; i++) {
        const x = -0.09 + i * 0.026;
        traceVerts.push(x, 0.001, 0.06, x, 0.001, 0.04);
      }
      const traceGeo = new THREE.BufferGeometry();
      traceGeo.setAttribute("position", new THREE.Float32BufferAttribute(traceVerts, 3));
      scene.add(new THREE.LineSegments(traceGeo, new THREE.LineBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.6 })));

      const animate = () => {
        if (!running) return;
        requestAnimationFrame(animate);
        controls.update();

        const g = useSim.getState().snap.gpio;
        for (let i = 0; i < 8; i++) {
          const on = (g.out[0] & (1 << i)) !== 0 && (g.dir[0] & (1 << i)) !== 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ledMeshes[i].material as any).emissiveIntensity = on ? 1 : 0;
          ledLights[i].intensity = on ? 0.4 : 0;
        }
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!mountRef.current) return;
        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener("resize", onResize);

      cleanupRef.current = () => {
        running = false;
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        window.removeEventListener("resize", onResize);
      };
    })();

    return () => { cleanupRef.current?.(); };
  }, []);

  return <div ref={mountRef} className="h-full w-full" aria-label="3D board view" />;
}
