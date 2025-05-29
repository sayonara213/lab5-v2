//@ts-nocheck

import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";

export let cleanup = () => {};

export async function init(container: HTMLElement, onBack: () => void) {
  // UI: Назад
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.onclick = onBack;
  container.appendChild(backBtn);

  // UI: Меню
  const menu = document.createElement("div");
  menu.id = "menu";
  menu.hidden = true;
  menu.innerHTML = `
    <label>🎨 Color: <input type="color" id="color-picker" value="#ff0000" /></label><br/>
    <label>🔁 Rotation: <button id="toggle-rotation">OFF</button></label><br/>
    <label>📏 Size: <input type="range" id="size-slider" min="0.3" max="2" step="0.1" value="1" />
      <span id="size-value">1</span>
    </label><br/>
    <label>💓 Pulse: <button id="toggle-pulse">OFF</button></label><br/>
    <label>🎭 Material:
      <select id="material-select">
        <option value="standard">Standard</option>
        <option value="emissive">Emissive</option>
        <option value="transparent">Transparent</option>
      </select>
    </label>
  `;
  container.appendChild(menu);

  // Three.js
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
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Reticle
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Torus (your object)
  const geometry = new THREE.TorusGeometry(0.2, 0.05, 16, 100);
  let currentMaterial: THREE.Material = new THREE.MeshStandardMaterial({
    color: "#ff0000",
  });
  const torus = new THREE.Mesh(geometry, currentMaterial);
  torus.visible = false;
  scene.add(torus);

  // State
  let rotate = false;
  let pulse = false;
  let scale = 1;
  let placed = false;

  // 🧠 Hit Test
  let hitTestSource: XRHitTestSource | null = null;
  let localSpace: XRReferenceSpace | null = null;

  renderer.xr.addEventListener("sessionstart", async () => {
    const session = renderer.xr.getSession()!;
    const viewerSpace = await session.requestReferenceSpace("viewer");
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    localSpace = await session.requestReferenceSpace("local");

    session.addEventListener("select", () => {
      if (!placed && reticle.visible) {
        torus.position.setFromMatrixPosition(reticle.matrix);
        torus.visible = true;
        placed = true;
        reticle.visible = false;
      }
    });

    menu.hidden = false;
  });

  renderer.xr.addEventListener("sessionend", () => {
    hitTestSource = null;
    localSpace = null;
    reticle.visible = false;
    torus.visible = false;
    placed = false;
    menu.hidden = true;
  });

  const clock = new THREE.Clock();

  // 🔁 Loop
  renderer.setAnimationLoop((_, frame) => {
    const t = clock.getElapsedTime();

    // Hit test
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

    // Animate torus
    if (torus.visible) {
      if (rotate) torus.rotation.y += 0.01;
      if (pulse) {
        const s = scale + 0.1 * Math.sin(t * 5);
        torus.scale.set(s, s, s);
      } else {
        torus.scale.set(scale, scale, scale);
      }
    }

    renderer.render(scene, camera);
  });

  // UI Logic
  const colorPicker = document.getElementById(
    "color-picker"
  ) as HTMLInputElement;
  colorPicker.oninput = () => {
    (torus.material as THREE.MeshStandardMaterial).color.set(colorPicker.value);
  };

  const toggleRotation = document.getElementById(
    "toggle-rotation"
  ) as HTMLButtonElement;
  toggleRotation.onclick = () => {
    rotate = !rotate;
    toggleRotation.textContent = rotate ? "ON" : "OFF";
  };

  const togglePulse = document.getElementById(
    "toggle-pulse"
  ) as HTMLButtonElement;
  togglePulse.onclick = () => {
    pulse = !pulse;
    togglePulse.textContent = pulse ? "ON" : "OFF";
  };

  const sizeSlider = document.getElementById("size-slider") as HTMLInputElement;
  const sizeValue = document.getElementById("size-value")!;
  sizeSlider.oninput = () => {
    scale = parseFloat(sizeSlider.value);
    sizeValue.textContent = scale.toFixed(1);
  };

  const materialSelect = document.getElementById(
    "material-select"
  ) as HTMLSelectElement;
  materialSelect.onchange = () => {
    const value = materialSelect.value;
    let newMat: THREE.Material;
    switch (value) {
      case "emissive":
        newMat = new THREE.MeshStandardMaterial({
          color: colorPicker.value,
          emissive: 0xffff00,
          emissiveIntensity: 0.6,
        });
        break;
      case "transparent":
        newMat = new THREE.MeshStandardMaterial({
          color: colorPicker.value,
          transparent: true,
          opacity: 0.5,
        });
        break;
      default:
        newMat = new THREE.MeshStandardMaterial({
          color: colorPicker.value,
        });
    }
    torus.material = newMat;
  };

  // AR Button
  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: container },
  });
  container.appendChild(arButton);

  // Cleanup
  cleanup = () => {
    renderer.setAnimationLoop(null);
    container.innerHTML = "";
  };
}
