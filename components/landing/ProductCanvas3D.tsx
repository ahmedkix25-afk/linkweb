'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface ProductCanvas3DProps {
  imageUrl: string;
  model3dUrl?: string;
  accentHex: string;
  isDark: boolean;
  reducedMotion: boolean;
  onFallback: () => void;
}

// Module-scoped reusable helpers to avoid GC allocations in render loop
const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.38)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.14)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export default function ProductCanvas3D({
  imageUrl,
  model3dUrl,
  accentHex,
  isDark,
  reducedMotion,
  onFallback,
}: ProductCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onFallbackRef = useRef(onFallback);

  useEffect(() => {
    onFallbackRef.current = onFallback;
  }, [onFallback]);

  const targetTiltRef = useRef({ x: 0, y: 0 });
  const textureMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);

  // Initialize Three.js WebGL stage once per model mode / theme
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      onFallbackRef.current();
      return;
    }

    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.12 : 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Procedural Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 5.2);

    // Balanced 3-Point Warm/Cool Studio Rig
    const hemiLight = new THREE.HemisphereLight(
      isDark ? 0xdbeafe : 0xffffff,
      isDark ? 0x0f172a : 0xe2e8f0,
      isDark ? 0.85 : 1.0
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, isDark ? 1.6 : 1.8);
    keyLight.position.set(3.5, 5, 4.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(new THREE.Color(accentHex), isDark ? 1.3 : 0.9);
    rimLight.position.set(-4, 2.5, -3.5);
    scene.add(rimLight);

    // Contact shadow plane directly beneath product
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(4.4, 2.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: isDark ? 0.65 : 0.42,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.48;
    scene.add(shadowPlane);

    // Subtle reflective accent ring on studio floor
    const ringGeo = new THREE.RingGeometry(1.55, 1.62, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentHex),
      transparent: true,
      opacity: isDark ? 0.28 : 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const floorRing = new THREE.Mesh(ringGeo, ringMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = -1.46;
    scene.add(floorRing);

    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const disposables: { dispose: () => void }[] = [
      envRT,
      shadowTex,
      shadowGeo,
      shadowMat,
      ringGeo,
      ringMat,
    ];

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = Boolean(model3dUrl);
    controls.minDistance = 2.8;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.minPolarAngle = Math.PI * 0.28;
    controls.enableDamping = !isSoftwareGl && !reducedMotion;
    controls.dampingFactor = 0.06;

    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }
    requestRenderRef.current = requestRender;

    // Build either GLB 3D Model or Composite Sculpted 3D Product Showcase Card
    if (model3dUrl && model3dUrl.trim()) {
      const loader = new GLTFLoader();
      loader.load(
        model3dUrl.trim(),
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = !isSoftwareGl;
              mesh.receiveShadow = !isSoftwareGl;
            }
          });
          _box.setFromObject(model);
          _box.getCenter(_center);
          _box.getSize(_size);
          const maxDim = Math.max(_size.x, _size.y, _size.z) || 1;
          const scale = 2.65 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(_center.multiplyScalar(scale));
          model.position.y += 0.1;
          heroGroup.add(model);
          requestRender();
        },
        undefined,
        () => {
          if (!disposed) buildSculptedPhotoCard();
        }
      );
    } else {
      buildSculptedPhotoCard();
    }

    function buildSculptedPhotoCard() {
      // Composite multi-part sculpted showcase frame (beveled metallic chassis + accent trim + crisp photo face + clearcoat crystal layer)
      const cardW = 3.25;
      const cardH = 2.44;
      const radius = 0.24;

      const chassisShape = createRoundedRectShape(cardW + 0.14, cardH + 0.14, radius + 0.04);
      const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 4,
      });
      chassisGeo.center();
      const chassisMat = new THREE.MeshPhysicalMaterial({
        color: isDark ? 0x1e293b : 0xe2e8f0,
        metalness: 0.82,
        roughness: 0.22,
        clearcoat: 0.85,
        clearcoatRoughness: 0.15,
      });
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      chassisMesh.castShadow = !isSoftwareGl;
      heroGroup.add(chassisMesh);

      // Subtle accent rim bezel around the back edge
      const accentShape = createRoundedRectShape(cardW + 0.18, cardH + 0.18, radius + 0.05);
      const accentGeo = new THREE.ExtrudeGeometry(accentShape, {
        depth: 0.03,
        bevelEnabled: false,
      });
      accentGeo.center();
      const accentMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(accentHex),
        metalness: 0.65,
        roughness: 0.3,
      });
      const accentMesh = new THREE.Mesh(accentGeo, accentMat);
      accentMesh.position.z = -0.075;
      heroGroup.add(accentMesh);

      // Front photo plane with crisp SRGBColorSpace & max anisotropy
      const faceGeo = new THREE.PlaneGeometry(cardW, cardH);
      const faceMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.32,
        metalness: 0.04,
      });
      textureMatRef.current = faceMat;
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.position.z = 0.105;
      heroGroup.add(faceMesh);

      // Subtle optical clearcoat glass reflection sheet on top
      const glassGeo = new THREE.PlaneGeometry(cardW, cardH);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: isSoftwareGl ? 0.08 : 0.12,
        roughness: 0.06,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        depthWrite: false,
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.z = 0.115;
      heroGroup.add(glassMesh);

      disposables.push(
        chassisGeo,
        chassisMat,
        accentGeo,
        accentMat,
        faceGeo,
        faceMat,
        glassGeo,
        glassMat
      );

      loadFaceTexture(imageUrl, faceMat);
    }

    function loadFaceTexture(url: string, mat: THREE.MeshStandardMaterial) {
      if (!url) return;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        url,
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if (mat.map) mat.map.dispose();
          mat.map = tex;
          mat.needsUpdate = true;
          requestRender();
        },
        undefined,
        () => {}
      );
    }

    // Handle pointer tilt smoothly
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetTiltRef.current.x = THREE.MathUtils.clamp(ny * 0.22, -0.26, 0.26);
      targetTiltRef.current.y = THREE.MathUtils.clamp(nx * 0.34, -0.38, 0.38);
      if (isSoftwareGl || reducedMotion) requestRender();
    };

    const handlePointerLeave = () => {
      targetTiltRef.current.x = 0;
      targetTiltRef.current.y = 0;
      if (isSoftwareGl || reducedMotion) requestRender();
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    controls.addEventListener('change', () => {
      if (isSoftwareGl || reducedMotion) requestRender();
    });

    // Context loss safety
    const onContextLost = (e: Event) => {
      e.preventDefault();
      onFallbackRef.current();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, entry.contentRect.width);
      const h = Math.max(1, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    // Continuous smooth damped loop on GPU, or on-demand render on software WebGL / reduced motion
    if (!isSoftwareGl && !reducedMotion) {
      const tick = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();

        const floatY = Math.sin(elapsed * 1.15) * 0.055;
        heroGroup.position.y = THREE.MathUtils.damp(heroGroup.position.y, floatY, 4, delta);

        const targetX = targetTiltRef.current.x;
        const targetY =
          targetTiltRef.current.y + (model3dUrl ? Math.sin(elapsed * 0.45) * 0.28 : Math.sin(elapsed * 0.55) * 0.08);

        heroGroup.rotation.x = THREE.MathUtils.damp(heroGroup.rotation.x, targetX, 5.5, delta);
        heroGroup.rotation.y = THREE.MathUtils.damp(heroGroup.rotation.y, targetY, 5.5, delta);

        controls.update();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    } else {
      requestRender();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      if (textureMatRef.current?.map) {
        textureMatRef.current.map.dispose();
      }
      textureMatRef.current = null;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [model3dUrl, accentHex, isDark, reducedMotion, imageUrl]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none touch-pan-y"
      aria-label="عرض ثلاثي الأبعاد تفاعلي للمنتج"
    />
  );
}
