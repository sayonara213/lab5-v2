//@ts-nocheck

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/addons/webxr/ARButton.js";

export let cleanup: () => void = () => {};

export async function init(container: HTMLElement, onBack: () => void) {
  // UI: Back + Menu
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.onclick = onBack;
  container.appendChild(backBtn);

  const menu = document.createElement("div");
  menu.id = "menu";
  menu.hidden = true;
  menu.innerHTML = `
    <button id="toggle-rotation">Rotation: ON</button>
    <button id="toggle-light">Scene Light: ON</button>
    <button id="toggle-model-light">Model Light: ON</button>
    <select id="light-type">
      <option value="point">Point Light</option>
      <option value="spot">Spot Light</option>
      <option value="directional">Directional Light</option>
    </select>
    <input id="light-intensity" type="range" min="0" max="5" step="0.1" value="1"/>
    <input id="light-color" type="color" value="#ffffff"/>
    <button id="toggle-material">Material: Original</button>
  `;
  container.appendChild(menu);

  // Three.js core
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

  const clock = new THREE.Clock();

  // Scene light
  const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(ambient);

  // Model
  let model: THREE.Group;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("Kids_Cycle.glb"); // заміни на свою іграшку

  model = gltf.scene;
  model.position.set(0, 0, -0.8);
  scene.add(model);

  // Model light (added later)
  let modelLight: THREE.Light = new THREE.PointLight(0xffffff, 1);
  model.add(modelLight);

  // Default material clone
  const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      originalMaterials.set(
        child as THREE.Mesh,
        (child as THREE.Mesh).material
      );
    }
  });

  const altMaterial = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });

  // Rotation toggle
  let rotate = true;
  document.getElementById("toggle-rotation")!.onclick = () => {
    rotate = !rotate;
    (
      document.getElementById("toggle-rotation") as HTMLButtonElement
    ).textContent = rotate ? "Rotation: ON" : "Rotation: OFF";
  };

  // Scene light toggle
  document.getElementById("toggle-light")!.onclick = () => {
    ambient.visible = !ambient.visible;
    (document.getElementById("toggle-light") as HTMLButtonElement).textContent =
      ambient.visible ? "Scene Light: ON" : "Scene Light: OFF";
  };

  // Model light toggle
  document.getElementById("toggle-model-light")!.onclick = () => {
    modelLight.visible = !modelLight.visible;
    (
      document.getElementById("toggle-model-light") as HTMLButtonElement
    ).textContent = modelLight.visible ? "Model Light: ON" : "Model Light: OFF";
  };

  // Light type switcher
  const typeSelector = document.getElementById(
    "light-type"
  ) as HTMLSelectElement;
  typeSelector.onchange = () => {
    model.remove(modelLight);
    const color = new THREE.Color(
      (document.getElementById("light-color") as HTMLInputElement).value
    );
    const intensity = parseFloat(
      (document.getElementById("light-intensity") as HTMLInputElement).value
    );
    switch (typeSelector.value) {
      case "point":
        modelLight = new THREE.PointLight(color, intensity);
        break;
      case "spot":
        modelLight = new THREE.SpotLight(color, intensity);
        break;
      case "directional":
        modelLight = new THREE.DirectionalLight(color, intensity);
        break;
    }
    model.add(modelLight);
  };

  // Light color and intensity
  const intensityInput = document.getElementById(
    "light-intensity"
  ) as HTMLInputElement;
  intensityInput.oninput = () => {
    modelLight.intensity = parseFloat(intensityInput.value);
  };

  const colorInput = document.getElementById("light-color") as HTMLInputElement;
  colorInput.oninput = () => {
    modelLight.color.set(colorInput.value);
  };

  // Material toggle
  let useAltMaterial = false;
  document.getElementById("toggle-material")!.onclick = () => {
    useAltMaterial = !useAltMaterial;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = useAltMaterial
          ? altMaterial
          : originalMaterials.get(mesh)!;
      }
    });

    (
      document.getElementById("toggle-material") as HTMLButtonElement
    ).textContent = useAltMaterial
      ? "Material: Alternative"
      : "Material: Original";
  };

  // AR button
  const arBtn = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: container },
  });
  container.appendChild(arBtn);

  renderer.xr.addEventListener("sessionstart", () => {
    menu.hidden = false;
  });
  renderer.xr.addEventListener("sessionend", () => {
    menu.hidden = true;
  });

  // Animate
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    if (rotate && model) {
      model.rotation.y = t * 0.5;
    }
    renderer.render(scene, camera);
  });

  // Cleanup
  cleanup = () => {
    renderer.setAnimationLoop(null);
    container.innerHTML = "";
  };
}
