//@ts-nocheck

import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export let cleanup = () => {};

export async function init(container: HTMLElement, onBack: () => void) {
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.onclick = onBack;
  container.appendChild(backBtn);

  const settingsPanel = document.createElement("div");
  settingsPanel.id = "menu";
  settingsPanel.innerHTML = `
    <h3>🔧 Planet Setup</h3>
    <label>🌈 Light color: <input type="color" id="light-color" value="#ffffff"/></label><br/>
    <label>💡 Light intensity: <input type="range" id="light-intensity" min="0" max="5" step="0.1" value="1"/></label><br/>
    <button id="toggle-light">Directional Light: ON</button><br/>
    <label>🎭 Material:
      <select id="material-select">
        <option value="realistic">Realistic</option>
        <option value="gold">Gold</option>
        <option value="glass">Glass</option>
        <option value="chrome">Chrome</option>
        <option value="glow">Glow</option>
      </select>
    </label><br/>
    <button id="toggle-rotate">Rotation: OFF</button>
    <button id="toggle-jump">Jump: OFF</button>
    <br/><br/>
    <button id="start-ar">START AR</button>
  `;
  container.appendChild(settingsPanel);

  // Three.js scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 2, 1);
  scene.add(directionalLight);

  const loader = new GLTFLoader();

  const planetModels = ["earth.glb", "saturn.glb", "sun.glb"];

  const planets: THREE.Object3D[] = [];

  for (const url of planetModels) {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.visible = false;
    model.scale.setScalar(1 / 10); // 🔽 Зменшення в 6 разів

    if (url === "saturn.glb") {
      model.scale.setScalar(1 / 1000);
    }

    if (url === "sun.glb") {
      model.scale.setScalar(1 / 100);
    }

    scene.add(model);
    planets.push(model);
  }

  // Materials
  const materials = {
    realistic: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 1,
      roughness: 0.3,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      transparent: true,
      opacity: 0.5,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.05,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x44ffff,
      emissiveIntensity: 1,
    }),
  };

  function applyMaterial(type: keyof typeof materials) {
    for (const planet of planets) {
      planet.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = materials[type];
        }
      });
    }
  }

  // UI handlers
  let rotate = false;
  let jump = false;
  let lightOn = true;

  const toggleRotate = document.getElementById("toggle-rotate")!;
  toggleRotate.onclick = () => {
    rotate = !rotate;
    toggleRotate.textContent = `Rotation: ${rotate ? "ON" : "OFF"}`;
  };

  const toggleJump = document.getElementById("toggle-jump")!;
  toggleJump.onclick = () => {
    jump = !jump;
    toggleJump.textContent = `Jump: ${jump ? "ON" : "OFF"}`;
  };

  const toggleLight = document.getElementById("toggle-light")!;
  toggleLight.onclick = () => {
    lightOn = !lightOn;
    directionalLight.visible = lightOn;
    toggleLight.textContent = `Directional Light: ${lightOn ? "ON" : "OFF"}`;
  };

  (document.getElementById("light-intensity") as HTMLInputElement).oninput = (
    e
  ) => {
    directionalLight.intensity = parseFloat(
      (e.target as HTMLInputElement).value
    );
  };

  (document.getElementById("light-color") as HTMLInputElement).oninput = (
    e
  ) => {
    directionalLight.color.set((e.target as HTMLInputElement).value);
  };

  (document.getElementById("material-select") as HTMLSelectElement).onchange = (
    e
  ) => {
    applyMaterial(
      (e.target as HTMLSelectElement).value as keyof typeof materials
    );
  };

  // Hit Test Setup
  let hitTestSource: XRHitTestSource | null = null;
  let localSpace: XRReferenceSpace | null = null;
  let placed = false;

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Animation
  const clock = new THREE.Clock();

  renderer.xr.addEventListener("sessionstart", async () => {
    const session = renderer.xr.getSession()!;
    const viewerSpace = await session.requestReferenceSpace("viewer");
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    localSpace = await session.requestReferenceSpace("local");

    session.addEventListener("select", () => {
      if (reticle.visible && !placed) {
        for (let i = 0; i < planets.length; i++) {
          const offsetX = (i - 1) * 0.6; // розставляємо трохи вліво/вправо
          planets[i].position.setFromMatrixPosition(reticle.matrix);
          planets[i].position.x += offsetX;
          planets[i].visible = true;
        }
        placed = true;
        reticle.visible = false;
      }
    });
  });

  renderer.xr.addEventListener("sessionend", () => {
    hitTestSource = null;
    localSpace = null;
    reticle.visible = false;
    planet.visible = false;
    placed = false;
    settingsPanel.hidden = false;
  });

  // Animation Loop
  renderer.setAnimationLoop((_, frame) => {
    const t = clock.getElapsedTime();

    if (frame && hitTestSource && !placed) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(localSpace!);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }

    if (placed) {
      for (const p of planets) {
        if (rotate) p.rotation.y += 0.005; // повільне обертання навколо осі
        if (jump) {
          const y = Math.abs(Math.sin(t * 3)) * 0.2;
          p.position.y = y;
        }
      }
    }

    renderer.render(scene, camera);
  });

  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: container },
  });
  container.appendChild(arButton);

  cleanup = () => {
    renderer.setAnimationLoop(null);
    container.innerHTML = "";
  };
}
