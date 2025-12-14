import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { SimulationMetrics, SimulationPhase, InputMode, TuningParams } from '../types';

interface BlindsightCanvasProps {
  onMetricsUpdate: (metrics: SimulationMetrics) => void;
  isRunning: boolean;
  inputMode: InputMode;
  mediaSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null;
  tuning: TuningParams;
}

const PARTICLE_COUNT = 48000; 
const SAMPLER_SIZE = 128;
const NOISE_BUFFER_SIZE = 10000;
const NOISE_BUFFER = new Float32Array(NOISE_BUFFER_SIZE);
for(let i=0; i<NOISE_BUFFER_SIZE; i++) NOISE_BUFFER[i] = (Math.random() - 0.5) * 2;

const BlindsightCanvas: React.FC<BlindsightCanvasProps> = ({ 
  onMetricsUpdate, 
  isRunning, 
  inputMode, 
  mediaSource,
  tuning
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  
  const velocitiesRef = useRef<Float32Array | null>(null);
  const layersRef = useRef<Uint8Array | null>(null);
  
  const controller1Ref = useRef<THREE.XRTargetRaySpace | null>(null);

  const stateRef = useRef({
    step: 0,
    nanoAgent: { x: 0, y: 0, targetX: 0, targetY: 0 },
    mouse: { x: 0, y: 0 },
    tuning: tuning,
    inputMode: inputMode,
    isRunning: isRunning,
    mediaSource: mediaSource
  });

  useEffect(() => {
    stateRef.current.tuning = tuning;
    stateRef.current.inputMode = inputMode;
    stateRef.current.isRunning = isRunning;
    stateRef.current.mediaSource = mediaSource;
  }, [tuning, inputMode, isRunning, mediaSource]);

  const samplerRef = useRef<HTMLCanvasElement | null>(null);

  // High-Quality Circular Glow Texture
  const createPhospheneTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Inner intense core
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(230, 240, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.premultiplyAlpha = true;
    return tex;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0012);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 4000);
    camera.position.z = 400;
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ 
        alpha: false, 
        antialias: false, // Post-proc handles AA or we accept aliasing for sharp dots
        powerPreference: "high-performance",
        stencil: false,
        depth: false
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const vrButton = VRButton.createButton(renderer);
    document.body.appendChild(vrButton);

    // 4. Post-Processing Pipeline
    const composer = new EffectComposer(renderer);
    
    // Pass 1: Scene
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Pass 2: Unreal Bloom (Glow)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
        1.2, // Strength
        0.5, // Radius
        0.9  // Threshold
    );
    composer.addPass(bloomPass);

    // Pass 3: RGB Shift (Aberration)
    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0.0015;
    composer.addPass(rgbShiftPass);

    // Pass 4: Film Grain (Texture)
    const filmPass = new FilmPass(
        0.35,   // noise intensity
        0.025,  // scanlines intensity
        648,    // scanlines count
        0       // grayscale
    );
    composer.addPass(filmPass);
    
    composerRef.current = composer;

    // 5. Geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const layers = new Uint8Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Layer Distribution: 60% Detail, 30% Fill, 10% Ambient
        const r = Math.random();
        let layer = 0;
        if (r > 0.60) layer = 1;
        if (r > 0.90) layer = 2;
        layers[i] = layer;

        // Initial Scatter Sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const rad = 200 + Math.random() * 400;
        
        positions[i*3] = rad * Math.sin(phi) * Math.cos(theta);
        positions[i*3+1] = rad * Math.sin(phi) * Math.sin(theta);
        positions[i*3+2] = rad * Math.cos(phi);

        colors[i*3] = 0.1; colors[i*3+1] = 0.1; colors[i*3+2] = 0.1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    velocitiesRef.current = velocities;
    layersRef.current = layers;

    const material = new THREE.PointsMaterial({
        size: 2.8,
        map: createPhospheneTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // XR Controllers
    const c1 = renderer.xr.getController(0);
    scene.add(c1);
    controller1Ref.current = c1;

    // Offscreen Sampler
    const sampler = document.createElement('canvas');
    sampler.width = SAMPLER_SIZE;
    sampler.height = SAMPLER_SIZE;
    samplerRef.current = sampler;

    const handleResize = () => {
        if (!containerRef.current || !camera || !renderer || !composer) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(null);
            rendererRef.current.dispose();
        }
        geometry.dispose();
        material.dispose();
    };
  }, []);

  // --- PHYSICS LOOP ---
  const renderLoop = useCallback(() => {
    const renderer = rendererRef.current;
    const composer = composerRef.current;
    const camera = cameraRef.current;
    const points = pointsRef.current;
    const velocities = velocitiesRef.current;
    const layers = layersRef.current;
    
    if (!renderer || !composer || !points || !velocities || !layers || !camera) return;

    const state = stateRef.current;
    const { isRunning, inputMode, mediaSource, tuning, nanoAgent } = state;
    const time = Date.now() * 0.001;

    // 1. INPUT SAMPLING
    let pixelData: Uint8ClampedArray | null = null;
    if (mediaSource && samplerRef.current) {
        const ctx = samplerRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            try {
                if (!(mediaSource instanceof HTMLVideoElement) || mediaSource.readyState >= 2) {
                    ctx.drawImage(mediaSource, 0, 0, SAMPLER_SIZE, SAMPLER_SIZE);
                    pixelData = ctx.getImageData(0, 0, SAMPLER_SIZE, SAMPLER_SIZE).data;
                }
            } catch (e) { /* ignore */ }
        }
    }

    // 2. AGENT LOGIC
    let tx = nanoAgent.targetX;
    let ty = nanoAgent.targetY;
    if (renderer.xr.isPresenting && controller1Ref.current) {
        const p = controller1Ref.current.position;
        tx = p.x * 300; ty = p.y * 300;
        state.tuning.diffusionRate = Math.min(0.5, tuning.diffusionRate + 0.05); // Boost in VR
    } else {
        // Wandering attention
        tx += (Math.sin(time * 0.5) * 50) + (Math.cos(time * 1.2) * 20);
        ty += (Math.cos(time * 0.4) * 40) + (Math.sin(time * 1.5) * 20);
        
        // Limits
        if (tx > 300) tx = 300; if (tx < -300) tx = -300;
        if (ty > 200) ty = 200; if (ty < -200) ty = -200;
    }
    nanoAgent.targetX = tx;
    nanoAgent.targetY = ty;
    nanoAgent.x += (tx - nanoAgent.x) * 0.05;
    nanoAgent.y += (ty - nanoAgent.y) * 0.05;

    // 3. DIFFUSION
    const positions = points.geometry.attributes.position.array as Float32Array;
    const colors = points.geometry.attributes.color.array as Float32Array;
    
    const bandwidth = tuning.diffusionRate;
    const coherence = 1.0 - tuning.hallucinationStrength;
    const depthScale = tuning.spatialDepth;
    const isVR = renderer.xr.isPresenting;

    // Bandwidth quantization logic
    const effSamplerSize = Math.floor(SAMPLER_SIZE * (0.1 + bandwidth * 0.9)); 
    
    const cols = 290; 
    const rows = 165;
    let activeTokens = 0;
    
    // Pre-calc coherent noise offsets
    const nX = time * 0.3;
    const nY = time * 0.2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Drop frames for low bandwidth simulation
        if (i % 8 > (bandwidth * 16)) continue;

        const i3 = i * 3;
        const layer = layers[i]; 

        // UV Recovery
        const col = i % cols;
        const row = (i / cols) | 0;
        const u = col / cols;
        const v = row / rows;

        // Sampling
        let r=0, g=0, b=0, bright=0;
        
        if (pixelData) {
            const qU = Math.floor(u * effSamplerSize) / effSamplerSize;
            const qV = Math.floor(v * effSamplerSize) / effSamplerSize;

            const sx = (qU * SAMPLER_SIZE) | 0;
            const sy = ((1-qV) * SAMPLER_SIZE) | 0;
            const pIdx = (sy * SAMPLER_SIZE + sx) * 4;

            if (pixelData[pIdx] !== undefined) {
                // Biologically plausible heatmap coloring
                const rawR = pixelData[pIdx];
                const rawG = pixelData[pIdx+1];
                const rawB = pixelData[pIdx+2];
                bright = (rawR + rawG + rawB) / (255 * 3);

                // Thermal Map Logic: Dark=Blue/Purple, Mid=Red, Bright=Yellow/White
                if (bright < 0.2) {
                    r = bright * 0.5; g = 0; b = 0.4 + bright;
                } else if (bright < 0.5) {
                    r = (bright - 0.2) * 3.3; g = 0; b = 0.6 - bright;
                } else if (bright < 0.8) {
                    r = 1.0; g = (bright - 0.5) * 3.3; b = 0;
                } else {
                    r = 1.0; g = 1.0; b = (bright - 0.8) * 5.0;
                }
            }
        }

        // Hallucination Vectors
        const noiseIdx = (i + Math.floor(time * 20)) % NOISE_BUFFER_SIZE;
        const noiseVal = NOISE_BUFFER[noiseIdx];
        const hStr = (1.0 - coherence) * 60;
        const hx = Math.sin(positions[i3]*0.015 + nX) * hStr;
        const hy = Math.cos(positions[i3+1]*0.015 + nY) * hStr;
        const hz = Math.sin(positions[i3]*0.02 + nX + noiseVal) * hStr;

        // Target Position
        let tx=0, ty=0, tz=0;
        if (isVR) {
            // Immersive sphere
            const theta = (u - 0.5) * Math.PI * 1.6;
            const phi = (v - 0.5) * Math.PI * 1.1;
            const radius = 60 + (bright * depthScale * 0.2) + (layer * 10);
            tx = radius * Math.sin(theta);
            ty = radius * Math.sin(phi);
            tz = -radius * Math.cos(theta);
        } else {
            // Planar with Parallax
            const theta = (u - 0.5) * Math.PI * 0.9;
            const phi = (v - 0.5) * Math.PI * 0.6;
            const radius = 350 + (bright * depthScale) + (layer * 30);
            tx = radius * Math.sin(theta) + hx;
            ty = radius * Math.sin(phi) + hy;
            tz = radius * Math.cos(theta) * Math.cos(phi) - 350 + hz;
        }

        // Physics Integration
        const x = positions[i3];
        const y = positions[i3+1];
        const z = positions[i3+2];

        // Nano Agent Gravity
        const dx = x - nanoAgent.x;
        const dy = y - nanoAgent.y;
        const distSq = dx*dx + dy*dy;
        const isAgentNear = distSq < 12000;
        if (isAgentNear) activeTokens++;

        // Spring Physics
        let k = isAgentNear ? 0.4 : (bandwidth * 0.5);
        if (layer === 2) k *= 0.15; // Ambient slow
        k *= coherence; // Low coherence = loose connection to reality

        const ax = (tx - x) * k;
        const ay = (ty - y) * k;
        const az = (tz - z) * k;

        velocities[i3]   += ax;
        velocities[i3+1] += ay;
        velocities[i3+2] += az;

        // Viscous Damping
        velocities[i3]   *= 0.85;
        velocities[i3+1] *= 0.85;
        velocities[i3+2] *= 0.85;

        positions[i3]   += velocities[i3];
        positions[i3+1] += velocities[i3+1];
        positions[i3+2] += velocities[i3+2];

        // Color Blending
        const cSpeed = 0.2;
        // Boost brightness for Detail layer
        const boost = layer === 0 ? 1.5 : 1.0;
        
        colors[i3]   += (r*boost - colors[i3]) * cSpeed;
        colors[i3+1] += (g*boost - colors[i3+1]) * cSpeed;
        colors[i3+2] += (b*boost - colors[i3+2]) * cSpeed;
    }

    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;

    // Mouse Parallax
    if (!isVR) {
        camera.position.x += (state.mouse.x * 25 - camera.position.x) * 0.05;
        camera.position.y += (state.mouse.y * 25 - camera.position.y) * 0.05;
        camera.lookAt(0,0,-100);
    }

    // Dynamic Post-Process Params based on Coherence
    const shiftPass = composer.passes.find(p => p instanceof ShaderPass && p.uniforms['amount']) as ShaderPass;
    if (shiftPass) {
        shiftPass.uniforms['amount'].value = 0.001 + (1.0 - coherence) * 0.005;
    }

    if (isRunning) {
        state.step++;
        onMetricsUpdate({
            step: state.step,
            predictionError: pixelData ? 0.02 + (1-coherence)*0.1 : 0.95,
            bandwidth: pixelData ? (bandwidth * 25) : 0,
            coherence: coherence,
            tokenRate: activeTokens * 90,
            phase: pixelData ? SimulationPhase.CONVERGENCE : SimulationPhase.CHAOS,
            inputMode: isVR ? InputMode.SPATIAL : inputMode
        });
    }

    composer.render();

  }, [onMetricsUpdate]);

  useEffect(() => {
    if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(renderLoop);
    }
  }, [renderLoop]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative overflow-hidden" />
  );
};

export default BlindsightCanvas;