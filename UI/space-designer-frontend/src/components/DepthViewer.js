import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../styles/DepthViewer.css";
import { useNavigate } from "react-router-dom";

export default function DepthViewer() {
  const mountRef = useRef(null);
  const navigate = useNavigate();

  // ───────────────────────────────
  // ⚙️  State Management
  // ───────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [depthUrl, setDepthUrl] = useState("");
  const [mathData, setMathData] = useState(null);
  const [scale, setScale] = useState(1.5);
  const [reasonedObjects, setReasonedObjects] = useState([]);

  // ───────────────────────────────
  // 🔹 Fetch Pipeline (Depth + Math + Reasoning)
  // ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError("");

        // 1️⃣ Get latest uploaded image
        const res = await fetch("http://localhost:5050/test-outputs");
        const data = await res.json();

        const latest = data.files
          ?.filter((f) => /\.(jpeg|jpg|png)$/i.test(f))
          .sort((a, b) => b.localeCompare(a))[0];

        if (!latest) throw new Error("No uploaded image found for depth rendering.");

        // 2️⃣ Generate depth map
        const depthRes = await fetch("http://localhost:5050/depth/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: latest }),
        });
        const depthData = await depthRes.json();
        if (!depthData.depth_url) throw new Error("Depth URL missing in response.");

        setDepthUrl(depthData.depth_url);

        // 3️⃣ Fetch Math Agent results (scaling + layout)
        const mathRes = await fetch("http://localhost:5050/math/run");
        const mathJson = await mathRes.json();
        setMathData(mathJson);

        // 4️⃣ Optional: Call Groq reasoning for scene correction
        const reasonRes = await fetch("http://localhost:5050/reason/groq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mathData: mathJson }),
        });

        const reasonJson = await reasonRes.json();
        if (reasonJson.correctedScene) {
          setReasonedObjects(reasonJson.correctedScene);
        }
      } catch (err) {
        console.error("❌ Initialization failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // ───────────────────────────────
  // 🧱 Three.js Scene Setup
  // ───────────────────────────────
  useEffect(() => {
    if (!depthUrl || !mathData || error) return;

    const mount = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(6, 8, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.3);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(-5, 10, 5);
    dir.castShadow = true;
    scene.add(dir);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Ground plane
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Depth map as displacement surface
    const loader = new THREE.TextureLoader();
    const depthTex = loader.load(depthUrl);

    const surfaceGeo = new THREE.PlaneGeometry(10, 10, 512, 512);
    const surfaceMat = new THREE.MeshStandardMaterial({
      map: depthTex,
      displacementMap: depthTex,
      displacementScale: scale * 0.4,
      metalness: 0.2,
      roughness: 0.8,
      color: 0xffffff,
    });

    const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0;
    surface.receiveShadow = true;
    scene.add(surface);

    // Semantic objects (Walls, Doors, etc.)
    const COLORS = { Wall: 0xffffff, Door: 0xa0522d, Window: 0x87ceeb };

    const sourceObjects = reasonedObjects.length
      ? reasonedObjects
      : mathData.objects.slice(0, 20);

    sourceObjects.forEach((obj) => {
      const height = obj.scaled_height_m || obj.size?.height || 2;
      const color = COLORS[obj.label] || 0xffffff;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(
          obj.size?.width || 0.4,
          height,
          obj.size?.depth || 0.4
        ),
        new THREE.MeshStandardMaterial({
          color,
          opacity: 0.85,
          transparent: true,
        })
      );

      const x = obj.position?.x ?? Math.random() * 8 - 4;
      const z = obj.position?.z ?? Math.random() * 8 - 4;
      box.position.set(x, height / 2, z);
      scene.add(box);
    });

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      surfaceGeo.dispose();
      surfaceMat.dispose();
    };
  }, [depthUrl, mathData, reasonedObjects, scale, error]);

  // ───────────────────────────────
  // 🎨 UI Rendering
  // ───────────────────────────────
  if (loading)
    return (
      <div className="center-screen">
        <span>🌀 Loading Depth + Scene Reasoning...</span>
      </div>
    );

  if (error)
    return (
      <div className="center-screen error">
        <span>❌ {error}</span>
      </div>
    );

  return (
    <div className="viewer-container">
      <div ref={mountRef} className="viewer-canvas" />

      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="back-btn">
        ← Back
      </button>

      {/* Height Scale Slider */}
      <div className="slider-container">
        <label>Height Scale: {scale.toFixed(1)}</label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
