import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
const taskSelector = document.getElementById("task-selector");

export let cleanup: () => void = () => {};

export async function init(container: HTMLElement, onBack: () => void) {
  // ← Back button
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", onBack);

  container.appendChild(backBtn);

  // 🔼 Menu container, initially hidden
  const menu = document.createElement("div");
  menu.id = "menu";
  menu.hidden = true;
  menu.innerHTML = `
    <button id="toggle-rotation">Disable Rotation</button>
    <button id="toggle-color">Emit Off</button>
    <button id="toggle-texture">Textures Off</button>
    <button id="toggle-pulse">Pulse Off</button>
    <button id="toggle-speed">Speed: Normal</button>
    <button id="toggle-effect">Effect Off</button>
    <button data-shape="torus">Torus</button>
    <button data-shape="sphere">Sphere</button>
    <button data-shape="cone">Cone</button>
  `;
  container.appendChild(menu);

  // --- Three.js setup ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // Light
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Shapes
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 16, 100),
    new THREE.MeshStandardMaterial({ color: "orange" })
  );
  torus.position.set(0, 0, -0.8);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 32, 32),
    new THREE.MeshStandardMaterial({ color: "skyblue" })
  );
  sphere.position.set(0, 0, -0.8);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.3, 32),
    new THREE.MeshStandardMaterial({ color: "hotpink" })
  );
  cone.position.set(0, 0, -0.8);

  let current: THREE.Mesh | null = null;

  function baseColor(obj: THREE.Mesh) {
    if (obj === torus) return "orange";
    if (obj === sphere) return "skyblue";
    return "hotpink";
  }

  function updateMaterial(obj: THREE.Mesh) {
    const mat = obj.material as THREE.MeshStandardMaterial;
    if (textureEnabled) {
      mat.map = texture;
      mat.color.set("white");
    } else {
      mat.map = null;
      mat.color.set(baseColor(obj));
    }
    if (emitEnabled) {
      mat.emissive.set("yellow");
      mat.emissiveIntensity = 0.6;
    } else {
      mat.emissive.set(0x000000);
    }
    mat.needsUpdate = true;
  }

  function showShape(shape: "torus" | "sphere" | "cone") {
    if (current) scene.remove(current);
    current = shape === "torus" ? torus : shape === "sphere" ? sphere : cone;
    scene.add(current);
    updateMaterial(current);
  }

  // Session event handlers
  const onSessionStart = () => (menu.hidden = false);
  const onSessionEnd = () => (menu.hidden = true);
  renderer.xr.addEventListener("sessionstart", onSessionStart);
  renderer.xr.addEventListener("sessionend", onSessionEnd);

  // Shape selection
  menu
    .querySelectorAll<HTMLButtonElement>("button[data-shape]")
    .forEach((btn) => {
      btn.addEventListener("click", () => showShape(btn.dataset.shape as any));
    });

  // Effect toggles
  let rotateEnabled = true,
    emitEnabled = false,
    textureEnabled = false,
    pulseEnabled = false,
    fastSpeed = false,
    effectEnabled = false;

  const texture = new THREE.TextureLoader().load("/texture.jpg");
  const clock = new THREE.Clock();

  // Rotation
  (menu.querySelector("#toggle-rotation") as HTMLButtonElement).onclick =
    () => {
      rotateEnabled = !rotateEnabled;
      (menu.querySelector("#toggle-rotation") as HTMLElement).textContent =
        rotateEnabled ? "Disable Rotation" : "Enable Rotation";
    };

  // Emissive color
  (menu.querySelector("#toggle-color") as HTMLButtonElement).onclick = () => {
    emitEnabled = !emitEnabled;
    [torus, sphere, cone].forEach(updateMaterial);
    (menu.querySelector("#toggle-color") as HTMLElement).textContent =
      emitEnabled ? "Emit On" : "Emit Off";
  };

  // Texture
  (menu.querySelector("#toggle-texture") as HTMLButtonElement).onclick = () => {
    textureEnabled = !textureEnabled;
    [torus, sphere, cone].forEach(updateMaterial);
    (menu.querySelector("#toggle-texture") as HTMLElement).textContent =
      textureEnabled ? "Textures On" : "Textures Off";
  };

  // Pulse
  (menu.querySelector("#toggle-pulse") as HTMLButtonElement).onclick = () => {
    pulseEnabled = !pulseEnabled;
    (menu.querySelector("#toggle-pulse") as HTMLElement).textContent =
      pulseEnabled ? "Pulse On" : "Pulse Off";
  };

  // Speed
  (menu.querySelector("#toggle-speed") as HTMLButtonElement).onclick = () => {
    fastSpeed = !fastSpeed;
    (menu.querySelector("#toggle-speed") as HTMLElement).textContent = fastSpeed
      ? "Speed: Fast"
      : "Speed: Normal";
  };

  // Effect flicker
  (menu.querySelector("#toggle-effect") as HTMLButtonElement).onclick = () => {
    effectEnabled = !effectEnabled;
    (menu.querySelector("#toggle-effect") as HTMLElement).textContent =
      effectEnabled ? "Effect On" : "Effect Off";
  };

  // AR button
  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: container },
  });
  container.appendChild(arButton);

  // Render loop
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    const speed = fastSpeed ? 2 : 1;
    const scale = pulseEnabled ? 1 + 0.1 * Math.sin(t * 4) : 1;
    const flicker = effectEnabled ? 0.5 + 0.5 * Math.sin(t * 10) : 1;

    [torus, sphere, cone].forEach((obj) => {
      obj.scale.set(scale, scale, scale);
      if (rotateEnabled) {
        obj.rotation.y += 0.01 * speed;
        obj.rotation.x += 0.005 * speed;
      }
      if (effectEnabled) {
        (obj.material as THREE.MeshStandardMaterial).emissiveIntensity =
          flicker * 0.8;
      }
    });

    renderer.render(scene, camera);
  });

  // Cleanup
  cleanup = () => {
    renderer.setAnimationLoop(null);
    renderer.xr.removeEventListener("sessionstart", onSessionStart);
    renderer.xr.removeEventListener("sessionend", onSessionEnd);
    container.innerHTML = "";
  };
}
