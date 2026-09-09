// -------------------------------------------------------------
// 1. Unicorn Studio Water Background Initialization & Grain Control
// -------------------------------------------------------------
let unicornScene = null;
let grainPlane = null;
let grainEnabled = true;
const DEFAULT_GRAIN_INTENSITY = 0.08;

function updateGrainUniform(plane, enabled) {
  if (plane && plane.uniforms && plane.uniforms.grainIntensity) {
    plane.uniforms.grainIntensity.value = enabled ? DEFAULT_GRAIN_INTENSITY : 0.0;
  }
}

function getGrainPlane(scene) {
  if (!scene) return null;
  const grainLayer = scene.layers?.find((l) => l.type === "grain");
  return grainLayer?.getPlane?.() || scene.curtain?.planes?.find((p) => p.userData?.type === "grain") || null;
}

let toastTimer = null;
function showGrainToast(enabled) {
  let toast = document.getElementById("grain-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "grain-toast";
    toast.className = "grain-toast";
    toast.innerHTML = '<span class="grain-toast-dot"></span><span class="grain-toast-text"></span><span class="grain-toast-key">G</span>';
    document.body.appendChild(toast);
  }

  const textEl = toast.querySelector(".grain-toast-text");
  if (textEl) {
    textEl.textContent = `Grain: ${enabled ? "ON" : "OFF"}`;
  }

  if (enabled) {
    toast.classList.remove("is-off");
  } else {
    toast.classList.add("is-off");
  }

  toast.classList.add("active");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, 1500);
}

function setGrain(enabled, showFeedback = true) {
  grainEnabled = enabled;
  if (!grainPlane && unicornScene) {
    grainPlane = getGrainPlane(unicornScene);
  }
  updateGrainUniform(grainPlane, grainEnabled);
  console.log(`[Grain Effect] ${grainEnabled ? "ON" : "OFF"}`);
  if (showFeedback) {
    showGrainToast(grainEnabled);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) {
    return;
  }
  if (e.key === "g" || e.key === "G") {
    setGrain(!grainEnabled);
  }
});

if (window.UnicornStudio) {
  UnicornStudio.addScene({
    elementId: "gravityCoding",
    fps: 100,
    scale: 1,
    dpi: 1,
    lazyLoad: false,
    filePath: "./WaterEffect/effect.json?t=" + Date.now(),
    interactivity: {
      mouse: {
        disableMobile: true,
      },
    },
  })
    .then((scene) => {
      console.log("UnicornStudio water background scene initialized.");
      unicornScene = scene;
      grainPlane = getGrainPlane(scene);
      updateGrainUniform(grainPlane, grainEnabled);
    })
    .catch((err) => {
      console.error("Error loading UnicornStudio scene:", err);
    });
}

// -------------------------------------------------------------
// 2. Three.js Aquarium Front-View Camera & Scene Setup
// -------------------------------------------------------------
const canvas = document.getElementById('webgl-canvas');
console.log("Initializing Three.js WebGL canvas (Aquarium front-view):", canvas);

const scene = new THREE.Scene();

// Camera positioned straight in front of the aquarium glass
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 14);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Tone Mapping & Color Space for rich, natural textures
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Balanced Natural Lighting for Aquarium View
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x113355, 0.7);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 12, 10);
scene.add(sunLight);

const frontRim = new THREE.PointLight(0xffb866, 0.9, 35);
frontRim.position.set(-6, 2, 8);
scene.add(frontRim);

// -------------------------------------------------------------
// 3. Fish Group & 3D Model Loading
// -------------------------------------------------------------
const fishGroup = new THREE.Group();
scene.add(fishGroup);

let fishModel = null;
let mixer = null;
let swimAction = null;
const clock = new THREE.Clock();

const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.setDecoderConfig({ type: 'js' });

const loader = new THREE.GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load(
  './assets/red-pagrus.glb',
  (gltf) => {
    console.log("GLB 3D model loaded successfully:", gltf);
    fishModel = gltf.scene;

    // Scale up model to occupy 43% of vertical screen height
    fishModel.scale.set(5.08, 5.08, 5.08);

    // Natural Organic Skin & Scale Material Settings
    fishModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.roughness = 0.45;
          child.material.metalness = 0.08;
          child.material.emissive = new THREE.Color(0x000000);
          child.material.needsUpdate = true;
        }
      }
    });

    fishGroup.add(fishModel);

    // Start swimming animation clip
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(fishModel);
      const clip =
        gltf.animations.find((a) => a.name === 'Swim_In_Place_Loop') ||
        gltf.animations[0];
      swimAction = mixer.clipAction(clip);
      swimAction.play();
    }
  },
  undefined,
  (error) => {
    console.error("Error loading GLB model:", error);
  }
);

// -------------------------------------------------------------
// 4. Mouse Tracking & Physics State
// -------------------------------------------------------------
const mouse = new THREE.Vector2(0, 0);
const targetPosition = new THREE.Vector3(0, 0, 0);
const raycaster = new THREE.Raycaster();
const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Z = 0 plane

const velocity = new THREE.Vector3(0, 0, 0);
const targetVelocity = new THREE.Vector3(0, 0, 0);

// Aquarium orientation state:
// Head angles 45° towards the viewer (positive Z) for prominent 3D front perspective
const BASE_FRONT_ANGLE = 45 * (Math.PI / 180);

let facingRight = true;
let currentYaw = -BASE_FRONT_ANGLE;
let currentPitchZ = 0;

function updateMouseTarget(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(targetPlane, targetPosition);
}

window.addEventListener('pointermove', (e) => {
  updateMouseTarget(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    updateMouseTarget(e.touches[0].clientX, e.touches[0].clientY);
  }
});

// -------------------------------------------------------------
// 5. Window Resize Handler
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// -------------------------------------------------------------
// 6. Aquarium Swimming & Natural Steering Loop
// -------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  if (fishGroup && fishModel) {
    const currentPos = fishGroup.position;
    const toTarget = new THREE.Vector3().subVectors(targetPosition, currentPos);
    const distance = toTarget.length();

    // Deadzone and smooth acceleration curve
    const deadzone = 0.5;
    const maxSpeed = 9.0;
    let desiredSpeed = 0;

    if (distance > deadzone) {
      desiredSpeed = Math.min((distance - deadzone) * 2.5, maxSpeed);
      toTarget.normalize().multiplyScalar(desiredSpeed);
      targetVelocity.copy(toTarget);
    } else {
      targetVelocity.set(0, 0, 0);
    }

    // Smooth fluid drag acceleration
    const accelRate = 1 - Math.exp(-3.5 * delta);
    velocity.lerp(targetVelocity, accelRate);

    // Apply movement
    currentPos.addScaledVector(velocity, delta);

    const speed = velocity.length();

    // Determine horizontal facing direction (hysteresis to prevent rapid switching)
    if (velocity.x > 0.25) {
      facingRight = true;
    } else if (velocity.x < -0.25) {
      facingRight = false;
    }

    // Target Yaw: 45° towards viewer, turning even more towards camera when resting
    const idleBonus = THREE.MathUtils.lerp(8 * (Math.PI / 180), 0, Math.min(speed / 3.0, 1.0));
    const currentFrontAngle = BASE_FRONT_ANGLE + idleBonus;
    const targetYaw = facingRight ? -currentFrontAngle : -(Math.PI - currentFrontAngle);

    // Target Pitch: gentle up/down tilt (max ±20°) when moving vertically
    const targetPitchZ = THREE.MathUtils.clamp(velocity.y * 0.05, -0.35, 0.35);

    // Smooth turning rates
    const turnRate = 1 - Math.exp(-4.5 * delta);
    const pitchRate = 1 - Math.exp(-5.0 * delta);

    currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, turnRate);
    currentPitchZ = THREE.MathUtils.lerp(currentPitchZ, targetPitchZ, pitchRate);

    // Apply rotation
    fishGroup.rotation.set(0, currentYaw, currentPitchZ);

    // Dynamic swim animation speed based on velocity
    if (swimAction) {
      const targetTimeScale = THREE.MathUtils.clamp(0.75 + speed * 0.22, 0.75, 2.2);
      const animRate = 1 - Math.exp(-4.0 * delta);
      swimAction.timeScale = THREE.MathUtils.lerp(swimAction.timeScale, targetTimeScale, animRate);
    }

    if (mixer) {
      mixer.update(delta);
    }
  }

  renderer.render(scene, camera);
}

animate();

